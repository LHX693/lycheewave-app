// Headless end-to-end checks of the main-process pipeline. Run: LycheeWave --lw-selftest <dir-with-media>
import { app, clipboard, safeStorage, systemPreferences } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { store, countWords, cleanSettingsPatch } from './store';
import { transcribeWav, convertWithFfmpeg, joinSegments, checkMediaPath, downloadModel, privateTmp, cleanupTmp, MODELS, modelPath } from './whisper';
import { pasteText } from './paste';
import { encodeWav, toSrt, toMd } from '../renderer/audio';

type R = { name: string; ok: boolean; detail: string };
export async function runSelfTest() {
  const res: R[] = [];
  const userClip = clipboard.readText();
  const t = async (name: string, fn: () => Promise<string> | string) => {
    const st = Date.now();
    try { res.push({ name, ok: true, detail: String(await fn()).slice(0, 300) + ` (${Date.now() - st} ms)` }); }
    catch (e: any) { res.push({ name, ok: false, detail: String(e?.message || e).slice(0, 300) }); }
  };
  const expectThrow = async (name: string, fn: () => unknown) => {
    try { await fn(); res.push({ name, ok: false, detail: 'did NOT throw' }); } catch (e: any) { res.push({ name, ok: true, detail: 'rejected: ' + String(e?.message || e).slice(0, 80) }); }
  };
  const dir = process.argv[process.argv.indexOf('--lw-selftest') + 1];
  const opts = { model: 'ggml-base-q5_1.bin', language: 'auto' };
  const tmpBefore = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('lw-') && !f.startsWith('lw-selftest-'));

  await t('bundled model present + SHA-256 matches pin', async () => {
    const p = modelPath('ggml-base-q5_1.bin'); if (!p) throw new Error('missing');
    const h = require('node:crypto').createHash('sha256'); h.update(fs.readFileSync(p)); const d = h.digest('hex');
    if (d !== MODELS[1].sha256) throw new Error('hash ' + d); return p;
  });
  for (const f of fs.readdirSync(dir).filter(f => /\.(wav|mp3|mp4|m4a)$/i.test(f)).sort()) {
    await t('file transcription (ffmpeg path): ' + f, async () => {
      const wav = await convertWithFfmpeg(checkMediaPath(path.join(dir, f)));
      try { const s = await transcribeWav(wav, opts); const txt = joinSegments(s); if (!txt) throw new Error('empty'); return `${s.length} segs, ${countWords(txt)} words: ${txt}`; }
      finally { fs.rmSync(wav, { force: true }); }
    });
  }
  await t('direct 16 kHz WAV → whisper (renderer-decoded path)', async () => {
    const s = await transcribeWav(checkMediaPath(path.join(dir, 'zh16k.wav')), opts); return joinSegments(s);
  });
  await t('meeting path: PCM chunks → encodeWav → whisper → history → SRT/MD', async () => {
    const b = fs.readFileSync(path.join(dir, 'meeting16k.wav')); const pcm = new Int16Array(b.buffer.slice(b.byteOffset + 44, b.byteOffset + b.length));
    const chunks: Int16Array[] = []; for (let i = 0; i < pcm.length; i += 4096) chunks.push(pcm.slice(i, i + 4096));
    const wavPath = path.join(privateTmp(), 'meeting.wav'); fs.writeFileSync(wavPath, Buffer.from(encodeWav(chunks)));
    const segs = await transcribeWav(wavPath, opts); fs.rmSync(wavPath);
    const text = segs.map(s => s.text).join('\n');
    store.add({ id: 'm1', kind: 'meeting', title: '测试会议', text, segments: segs, createdAt: Date.now(), durationMs: pcm.length / 16, words: countWords(text) });
    const srt = toSrt(segs), md = toMd('测试会议', segs);
    if (!store.history().some(e => e.id === 'm1') || !/-->/.test(srt) || !md.startsWith('# 测试会议')) throw new Error('export/history failed');
    return `${segs.length} segs; SRT first line block: ${srt.split('\n').slice(0, 3).join(' | ')}`;
  });
  await t('hostile file name is not executed by a shell', async () => {
    const f = path.join(dir, '$(touch PWNED);-y `id`.mp3');
    const wav = await convertWithFfmpeg(checkMediaPath(f)); fs.rmSync(wav, { force: true });
    if (fs.existsSync(path.join(dir, 'PWNED')) || fs.existsSync('PWNED')) throw new Error('command injected!'); return 'ok, no PWNED file';
  });
  await expectThrow('file:read rejects /etc/passwd', () => checkMediaPath('/etc/passwd'));
  await expectThrow('file:read rejects relative path', () => checkMediaPath('../x.mp3'));
  await expectThrow('file:read rejects ~/.ssh style non-media', () => checkMediaPath(path.join(os.homedir(), '.zshrc')));
  await expectThrow('model download rejects traversal name', () => downloadModel('../../evil.bin', () => {}));
  await expectThrow('settings rejects http:// AI endpoint', () => cleanSettingsPatch({ aiBaseUrl: 'http://example.com/v1' }, []));
  await t('settings: unknown keys/types dropped', () => { const p = cleanSettingsPatch({ model: '../../x', evil: 1, autoPaste: 'yes', language: 'zh' }, MODELS.map(m => m.file)); if (Object.keys(p).join() !== 'language') throw new Error(JSON.stringify(p)); return JSON.stringify(p); });
  await t('API key encrypted at rest (safeStorage/Keychain)', () => {
    store.saveSettings({ aiKey: 'sk-selftest-123', aiBaseUrl: 'https://api.example.com/v1' });
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8');
    if (raw.includes('sk-selftest-123')) throw new Error('plaintext key on disk');
    if (!safeStorage.isEncryptionAvailable()) { if (store.settings().aiKey !== 'sk-selftest-123') throw new Error('session key lost'); return 'keychain unavailable → key NOT written to disk, kept in memory only'; }
    if (store.settings().aiKey !== 'sk-selftest-123') throw new Error('round-trip failed'); return 'stored as ' + JSON.parse(raw).aiKey.slice(0, 14) + '…';
  });
  await t('data dir 0700 / files 0600', () => {
    store.saveSettings({}); store.add({ id: 'selftest-perm', kind: 'file', title: 't', text: 't', createdAt: Date.now() } as any);
    const d = app.getPath('userData'); const m = (p: string) => (fs.statSync(p).mode & 0o777).toString(8);
    const r = `dir ${m(d)}, settings ${m(path.join(d, 'settings.json'))}, history ${m(path.join(d, 'history.json'))}`;
    if (!/dir 700, settings 600, history 600/.test(r)) throw new Error(r); return r;
  });
  const trusted = process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : false;
  await t('paste: clipboard fallback + restore', async () => {
    clipboard.writeText('ORIGINAL-CLIP');
    const pasted = await pasteText('LW-PASTE-TEST', true);
    const now = clipboard.readText();
    if (!trusted) { clipboard.writeText(userClip); return `Accessibility NOT granted → pasteText returned ${pasted}, text left on clipboard (by design: "${now}")`; }
    clipboard.writeText(userClip); if (now !== 'ORIGINAL-CLIP') throw new Error('clipboard not restored: ' + now); return 'pasted=' + pasted + ', clipboard restored';
  });
  cleanupTmp();
  await t('no temp audio left behind', () => {
    const left = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('lw-') && !f.startsWith('lw-selftest-') && !tmpBefore.includes(f));
    const priv = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('lycheewave-'));
    if (left.length || priv.length) throw new Error(left.concat(priv).join(',')); return 'clean';
  });
  fs.rmSync(app.getPath('userData'), { recursive: true, force: true });
  process.stdout.write('LW_SELFTEST_JSON ' + JSON.stringify({ version: app.getVersion(), packaged: app.isPackaged, accessibilityTrusted: trusted, results: res }) + '\n');
  app.exit(res.every(r => r.ok) ? 0 : 1);
}
