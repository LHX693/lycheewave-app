import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import { TMP } from './electron-mock';
import { store, countWords, cleanSettingsPatch, cleanEntryPatch, defaults } from '../src/main/store';
import { joinSegments, checkMediaPath, downloadModel, modelPath, MODELS } from '../src/main/whisper';
import { buildChatRequest, chat } from '../src/main/ai';
import { toSrt, toMd, clock, encodeWav } from '../src/renderer/audio';
import { keyToAccel, hotkeyLabel } from '../src/renderer/hotkey';
const E = (id: string, text: string) => ({ id, kind: 'dictation' as const, title: text.slice(0, 5), text, createdAt: 1, durationMs: 1000, words: countWords(text) });

test('storage CRUD', () => {
  assert.deepEqual(store.history(), []);
  store.add(E('a', '你好')); store.add(E('b', 'hello world'));
  assert.deepEqual(store.history().map(e => e.id), ['b', 'a']);
  store.update('a', { summary: 'S' }); assert.equal(store.history().find(e => e.id === 'a')!.summary, 'S');
  store.remove('b'); assert.deepEqual(store.history().map(e => e.id), ['a']);
  store.update('missing', { text: 'x' }); assert.equal(store.history().length, 1);
});
test('corrupt history.json falls back to empty', () => { fs.writeFileSync(path.join(TMP, 'history.json'), '{bad'); assert.deepEqual(store.history(), []); });
test('file modes 0600/0700', () => {
  store.saveSettings({}); assert.equal(fs.statSync(path.join(TMP, 'settings.json')).mode & 0o777, 0o600); assert.equal(fs.statSync(TMP).mode & 0o777, 0o700);
});
test('word counting', () => {
  assert.equal(countWords('你好世界'), 4); assert.equal(countWords('hello world'), 2);
  assert.equal(countWords('我用 LycheeWave 写了 3 段'), 7); assert.equal(countWords(''), 0); assert.equal(countWords("don't stop"), 2);
});
test('SRT export', () => {
  const s = toSrt([{ from: 0, to: 1500, text: '一' }, { from: 3_723_004, to: 3_725_000, text: 'two' }]);
  assert.equal(s, '1\n00:00:00,000 --> 00:00:01,500\n一\n\n2\n01:02:03,004 --> 01:02:05,000\ntwo\n');
});
test('MD export', () => {
  assert.equal(toMd('标题', [{ from: 61000, to: 62000, text: 'x' }]), '# 标题\n\n**[00:01:01]** x\n');
  assert.match(toMd('T', [{ from: 0, to: 1, text: 'y' }], '## 摘要'), /^# T\n\n## 摘要\n\n## 逐字稿\n\n\*\*\[00:00:00\]\*\* y\n$/);
  assert.equal(clock(65000), '00:01:05');
});
test('WAV encoder header', () => {
  const b = Buffer.from(encodeWav([new Int16Array([1, 2]), new Int16Array([3])]));
  assert.equal(b.toString('latin1', 0, 4), 'RIFF'); assert.equal(b.readUInt32LE(24), 16000); assert.equal(b.length, 44 + 6); assert.equal(b.readInt16LE(48), 3);
});
test('joinSegments spacing', () => { assert.equal(joinSegments([{ from: 0, to: 1, text: 'Hello' }, { from: 1, to: 2, text: 'world' }, { from: 2, to: 3, text: '你好' }]), 'Hello world你好'); });
test('settings persistence + defaults + key encrypted at rest', () => {
  store.saveSettings({ hotkey: 'Command+Shift+D', language: 'zh', aiKey: 'sk-secret' });
  const raw = fs.readFileSync(path.join(TMP, 'settings.json'), 'utf8');
  assert.ok(!raw.includes('sk-secret')); assert.match(JSON.parse(raw).aiKey, /^enc:v1:/);
  const s = store.settings(); assert.equal(s.hotkey, 'Command+Shift+D'); assert.equal(s.aiKey, 'sk-secret'); assert.equal(s.model, defaults.model);
  // legacy plaintext key still readable
  fs.writeFileSync(path.join(TMP, 'settings.json'), JSON.stringify({ aiKey: 'sk-old' })); assert.equal(store.settings().aiKey, 'sk-old');
});
test('settings validation', () => {
  const known = MODELS.map(m => m.file);
  assert.deepEqual(cleanSettingsPatch({ model: '../../etc/passwd', foo: 1, autoPaste: 'true', hotkey: 'Alt+Space; rm' }, known), {});
  assert.deepEqual(cleanSettingsPatch({ aiBaseUrl: 'https://api.x.com/v1', language: 'en' }, known), { aiBaseUrl: 'https://api.x.com/v1', language: 'en' });
  assert.throws(() => cleanSettingsPatch({ aiBaseUrl: 'http://api.x.com' }, known));
  assert.throws(() => cleanSettingsPatch({ aiBaseUrl: 'https://u:p@api.x.com' }, known));
  assert.throws(() => cleanSettingsPatch({ aiBaseUrl: 'file:///etc/passwd' }, known));
  assert.doesNotThrow(() => cleanSettingsPatch({ aiBaseUrl: 'http://localhost:11434/v1' }, known));
});
test('history patch whitelist', () => {
  assert.deepEqual(cleanEntryPatch({ id: 'x', words: 999, text: 't', kind: 'evil', segments: [{ from: 0, to: 1, text: 'a' }, { bad: 1 }] }), { text: 't', segments: [{ from: 0, to: 1, text: 'a' }] });
});
test('hotkey parsing', () => {
  const k = (code: string, m: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>>) => keyToAccel({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, code, ...m });
  assert.equal(k('Space', { altKey: true }), 'Alt+Space'); assert.equal(k('KeyD', { metaKey: true, shiftKey: true }), 'Command+Shift+D');
  assert.equal(k('Digit5', { ctrlKey: true }), 'Control+5'); assert.equal(k('F5', { altKey: true }), 'Alt+F5');
  assert.equal(k('KeyA', {}), null); assert.equal(k('ShiftLeft', { shiftKey: true }), null);
  assert.equal(hotkeyLabel('Alt+Space'), '⌥ 空格');
});
test('media path guard', () => {
  const ok = path.join(TMP, 'a b;$(x).mp3'); fs.writeFileSync(ok, 'x');
  assert.equal(checkMediaPath(ok), fs.realpathSync(ok));
  for (const bad of ['/etc/passwd', 'rel.mp3', path.join(TMP, 'settings.json'), TMP + '/nope.mp3', 42, null]) assert.throws(() => checkMediaPath(bad as any));
  fs.symlinkSync('/etc/passwd', path.join(TMP, 'link.mp3')); assert.throws(() => checkMediaPath(path.join(TMP, 'link.mp3')));
});
test('model name guard', async () => {
  await assert.rejects(downloadModel('../../x.bin', () => {})); assert.equal(modelPath('../settings.json'), null);
});
test('AI request builder', () => {
  const { url, init } = buildChatRequest({ aiBaseUrl: 'https://api.example.com/v1/', aiKey: 'k1', aiModel: 'm' }, 'sys', 'hi');
  assert.equal(url, 'https://api.example.com/v1/chat/completions'); assert.equal(init.redirect, 'error');
  assert.equal(init.headers.Authorization, 'Bearer k1');
  assert.deepEqual(JSON.parse(init.body), { model: 'm', temperature: 0.2, messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }] });
  assert.throws(() => buildChatRequest({ aiBaseUrl: 'http://evil.com', aiKey: 'k', aiModel: 'm' }, 's', 'u'));
});
test('AI chat against mocked server (success, error redaction, redirect blocked)', async () => {
  let seen: any = null;
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    seen = { url: req.url, auth: req.headers.authorization, body: JSON.parse(b || '{}') };
    if (req.url === '/ok/chat/completions') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: ' 整理好了 ' } }] })); }
    else if (req.url === '/redir/chat/completions') { res.statusCode = 302; res.setHeader('location', 'http://127.0.0.1:1/steal'); res.end(); }
    else { res.statusCode = 401; res.end('bad key sk-abc'); } }); });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r)); const port = (srv.address() as any).port;
  const s = { ...defaults, aiKey: 'sk-abc', aiModel: 'gpt-x', aiBaseUrl: `http://localhost:${port}/ok` };
  assert.equal(await chat(s, 'S', '嗯 那个 你好'), '整理好了'); assert.equal(seen.auth, 'Bearer sk-abc'); assert.equal(seen.body.messages[1].content, '嗯 那个 你好');
  await assert.rejects(chat({ ...s, aiBaseUrl: `http://localhost:${port}/fail` }, 'S', 'x'), (e: any) => /401/.test(e.message) && !e.message.includes('sk-abc'));
  await assert.rejects(chat({ ...s, aiBaseUrl: `http://localhost:${port}/redir` }, 'S', 'x'));
  srv.close();
});
