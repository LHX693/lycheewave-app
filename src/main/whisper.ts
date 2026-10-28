import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

let tmpBase = '';
/** Private 0700 temp dir for audio/JSON scratch files. */
export function privateTmp(): string {
  if (!tmpBase || !fs.existsSync(tmpBase)) tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'lycheewave-'));
  fs.chmodSync(tmpBase, 0o700);
  return tmpBase;
}
export function cleanupTmp() { if (tmpBase) fs.rmSync(tmpBase, { recursive: true, force: true }); tmpBase = ''; }
export const isKnownModel = (f: unknown): f is string => typeof f === 'string' && MODELS.some(m => m.file === f);
export const MEDIA_EXT = ['mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'opus', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'aiff', 'aif', 'caf'];
/** Accepts only absolute paths to existing regular media files (blocks arbitrary reads and ffmpeg option/URL injection). */
export function checkMediaPath(p: unknown, maxBytes = 4 * 1024 ** 3): string {
  if (typeof p !== 'string' || !path.isAbsolute(p) || p.includes('\0')) throw new Error('无效的文件路径');
  const r = fs.realpathSync(p);
  const ext = path.extname(r).slice(1).toLowerCase();
  if (!MEDIA_EXT.includes(ext)) throw new Error('不支持的文件类型');
  const st = fs.statSync(r);
  if (!st.isFile() || st.size > maxBytes) throw new Error('文件不可读或过大');
  return r;
}

export const MODELS = [
  { file: 'ggml-tiny-q5_1.bin', label: 'Tiny（31 MB，最快）', size: 32152673, sha256: '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7' },
  { file: 'ggml-base-q5_1.bin', label: 'Base（57 MB，推荐，已内置）', size: 59707625, sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898' },
  { file: 'ggml-small-q5_1.bin', label: 'Small（181 MB，更准）', size: 190085487, sha256: 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' },
  { file: 'ggml-large-v3-turbo-q5_0.bin', label: 'Large v3 Turbo（547 MB，最准，较慢）', size: 574041195, sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2' },
];
const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

export const userModelDir = () => path.join(app.getPath('userData'), 'models');
const bundledModelDir = () => path.join(process.resourcesPath || '', 'models');

export function modelPath(file: string): string | null {
  if (!isKnownModel(file)) return null;
  for (const d of [userModelDir(), bundledModelDir(), path.join(app.getAppPath(), 'vendor/models')]) {
    const p = path.join(d, file);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
export function listModels() { return MODELS.map(m => ({ ...m, installed: !!modelPath(m.file) })); }

export function whisperBin(): string | null {
  const exe = process.platform === 'win32' ? '.exe' : '';
  const c = [path.join(process.resourcesPath || '', 'bin', 'whisper-cli' + exe), path.join(app.getAppPath(), 'vendor', 'bin', 'whisper-cli' + exe)];
  if (process.platform === 'darwin') c.push('/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli');
  return c.find(p => fs.existsSync(p)) || null;
}
export function ffmpegBin(): string | null {
  if (process.platform === 'win32') {
    const dirs = [path.join(process.resourcesPath || '', 'bin'), ...(process.env.PATH || '').split(';').filter(d => path.isAbsolute(d))];
    return dirs.map(d => path.join(d, 'ffmpeg.exe')).find(p => fs.existsSync(p)) || null;
  }
  return [path.join(process.resourcesPath || '', 'bin', 'ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(p => fs.existsSync(p)) || null;
}

export function downloadModel(file: string, onProgress: (p: number) => void): Promise<void> {
  const meta = MODELS.find(m => m.file === file);
  if (!meta) return Promise.reject(new Error('未知模型'));
  fs.mkdirSync(userModelDir(), { recursive: true, mode: 0o700 });
  const dest = path.join(userModelDir(), file);
  const get = (url: string, redirects = 0): Promise<void> => new Promise((resolve, reject) => {
    if (new URL(url).protocol !== 'https:') { reject(new Error('拒绝非 HTTPS 下载')); return; }
    https.get(url, { headers: { 'User-Agent': 'LycheeWave/0.2' } }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 8) {
        res.resume(); resolve(get(new URL(res.headers.location, url).toString(), redirects + 1)); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('下载失败 HTTP ' + res.statusCode)); return; }
      const total = Number(res.headers['content-length'] || 0); let got = 0;
      const out = fs.createWriteStream(dest + '.part', { mode: 0o600 });
      const h = crypto.createHash('sha256');
      res.on('data', c => { got += c.length; h.update(c); if (total) onProgress(got / total); });
      res.pipe(out);
      const fail = (e: Error) => { fs.rmSync(dest + '.part', { force: true }); reject(e); };
      out.on('finish', () => {
        const d = h.digest('hex');
        if (d !== meta.sha256) { fail(new Error('模型校验失败（SHA-256 不匹配），已丢弃')); return; }
        fs.renameSync(dest + '.part', dest); resolve();
      });
      out.on('error', fail); res.on('error', fail);
    }).on('error', reject);
  });
  return get(HF + file);
}

export interface Segment { from: number; to: number; text: string }

/** Runs whisper.cpp on a 16 kHz mono WAV and returns timed segments. */
export function transcribeWav(wav: string, opts: { model: string; language: string }): Promise<Segment[]> {
  const bin = whisperBin();
  if (!bin) return Promise.reject(new Error('找不到 whisper-cli 转写引擎'));
  const model = modelPath(opts.model) || MODELS.map(m => modelPath(m.file)).find(Boolean);
  if (!model) return Promise.reject(new Error('还没有可用的语音模型，请到“设置”下载一个'));
  const base = path.join(privateTmp(), 'lw-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  const args = ['-m', model, '-f', wav, '-l', opts.language, '-oj', '-of', base, '-np', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 2)))];
  // Nudges the model toward Simplified Chinese with punctuation.
  if (opts.language !== 'en') args.push('--prompt', '以下是普通话的句子，使用简体中文和标点。');
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, _so, se) => {
      try {
        if (err) fs.rmSync(base + '.json', { force: true });
        if (err) throw new Error('转写失败：' + (se || err.message).toString().slice(-400));
        const j = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
        fs.rmSync(base + '.json', { force: true });
        const segs: Segment[] = (j.transcription || []).map((s: any) => ({ from: s.offsets.from, to: s.offsets.to, text: String(s.text).trim() }))
          .filter((s: Segment) => s.text && !/^\[.*\]$|^\(.*\)$/.test(s.text));
        resolve(segs);
      } catch (e) { reject(e); }
    });
  });
}

export function convertWithFfmpeg(input: string): Promise<string> {
  const ff = ffmpegBin();
  const ext = path.extname(input).toLowerCase();
  if (!ff && path.isAbsolute(input) && ['.wav', '.mp3', '.flac'].includes(ext)) {
    // whisper.cpp decodes these itself (miniaudio); hand it a private copy so the caller can delete it.
    const copy = path.join(privateTmp(), 'lw-in-' + Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
    fs.copyFileSync(input, copy); fs.chmodSync(copy, 0o600);
    return Promise.resolve(copy);
  }
  if (!ff) return Promise.reject(new Error(process.platform === 'win32' ? '无法解码此文件，且未找到 ffmpeg（可用 winget install ffmpeg 安装）' : '无法解码此文件，且未找到 ffmpeg（可用 brew install ffmpeg 安装）'));
  const out = path.join(privateTmp(), 'lw-ff-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.wav');
  // Absolute path required: prevents "-option" or "proto:" style names being treated as flags/URLs.
  if (!path.isAbsolute(input)) return Promise.reject(new Error('无效的文件路径'));
  return new Promise((res, rej) => execFile(ff, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file', '-i', 'file:' + input, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out], { timeout: 30 * 60 * 1000 },
    (e, _o, se) => { if (e) { fs.rmSync(out, { force: true }); rej(new Error('ffmpeg 转换失败：' + String(se || e.message).slice(-300))); } else res(out); }));
}

export function joinSegments(s: Segment[]): string {
  let t = '';
  for (const x of s) {
    const prev = t.slice(-1), first = x.text[0] || '';
    t += t && /[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(first) ? ' ' + x.text : x.text;
  }
  return t.trim();
}
