import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface Settings {
  hotkey: string;
  model: string;
  language: 'auto' | 'zh' | 'en';
  autoPaste: boolean;
  restoreClipboard: boolean;
  launchAtLogin: boolean;
  aiPolish: boolean;
  aiBaseUrl: string;
  aiKey: string;
  aiModel: string;
  onboarded: boolean;
}
export interface Entry {
  id: string;
  kind: 'dictation' | 'file' | 'meeting';
  title: string;
  text: string;
  raw?: string;
  summary?: string;
  segments?: { from: number; to: number; text: string }[];
  createdAt: number;
  durationMs: number;
  words: number;
}

export const defaults: Settings = {
  hotkey: process.platform === 'win32' ? 'Control+Shift+Space' : 'Alt+Space', model: 'ggml-base-q5_1.bin', language: 'auto', autoPaste: true, restoreClipboard: true,
  launchAtLogin: false, aiPolish: false, aiBaseUrl: '', aiKey: '', aiModel: 'gpt-4o-mini', onboarded: false,
};

const dir = () => app.getPath('userData');
function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(path.join(dir(), file), 'utf8')); } catch { return fallback; }
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir(), 0o700); } catch {}
  const p = path.join(dir(), file);
  fs.writeFileSync(p + '.tmp', JSON.stringify(data, null, 1), { mode: 0o600 });
  fs.renameSync(p + '.tmp', p);
  fs.chmodSync(p, 0o600);
}
const ENC = 'enc:v1:';
const canEncrypt = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
// If the OS keychain/DPAPI is unavailable the key is kept in memory for this session only; it is never written in plaintext.
let sessionKey = '';
export const secretStorageAvailable = canEncrypt;
export function sealSecret(v: string): string {
  if (!v) { sessionKey = ''; return ''; }
  if (canEncrypt()) { sessionKey = ''; return ENC + safeStorage.encryptString(v).toString('base64'); }
  sessionKey = v; return '';
}
export const sessionSecret = () => sessionKey;
export function openSecret(v: string): string {
  if (!v || !v.startsWith(ENC)) return v || '';
  try { return safeStorage.decryptString(Buffer.from(v.slice(ENC.length), 'base64')); } catch { return ''; }
}
const KINDS = ['dictation', 'file', 'meeting'];
const str = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : undefined;
function cleanSegs(v: unknown) {
  if (!Array.isArray(v)) return undefined;
  return v.slice(0, 100000).filter(s => s && typeof s === 'object' && Number.isFinite(s.from) && Number.isFinite(s.to) && typeof s.text === 'string')
    .map(s => ({ from: Number(s.from), to: Number(s.to), text: String(s.text).slice(0, 10000) }));
}
/** Whitelists and type-checks renderer-supplied history fields. */
export function cleanEntryPatch(p: any): Partial<Entry> {
  if (!p || typeof p !== 'object') return {};
  const o: Partial<Entry> = {};
  if (str(p.title, 200) !== undefined) o.title = str(p.title, 200);
  if (str(p.text, 2_000_000) !== undefined) o.text = str(p.text, 2_000_000);
  if (str(p.summary, 200_000) !== undefined) o.summary = str(p.summary, 200_000);
  if (KINDS.includes(p.kind)) o.kind = p.kind;
  const sg = cleanSegs(p.segments); if (sg) o.segments = sg;
  if (Number.isFinite(p.durationMs) && p.durationMs >= 0) o.durationMs = Number(p.durationMs);
  if (Number.isFinite(p.createdAt) && p.createdAt > 0) o.createdAt = Number(p.createdAt);
  return o;
}
/** Whitelists and type-checks renderer-supplied settings. Returns the clean patch or throws. */
export function cleanSettingsPatch(p: any, knownModels: string[]): Partial<Settings> {
  if (!p || typeof p !== 'object') return {};
  const o: Partial<Settings> = {};
  for (const k of ['autoPaste', 'restoreClipboard', 'launchAtLogin', 'aiPolish', 'onboarded'] as const) if (typeof p[k] === 'boolean') o[k] = p[k];
  if (typeof p.hotkey === 'string' && /^[A-Za-z0-9+]{1,60}$/.test(p.hotkey)) o.hotkey = p.hotkey;
  if (typeof p.model === 'string' && knownModels.includes(p.model)) o.model = p.model;
  if (['auto', 'zh', 'en'].includes(p.language)) o.language = p.language;
  if (typeof p.aiModel === 'string') o.aiModel = p.aiModel.trim().slice(0, 100);
  if (typeof p.aiKey === 'string') o.aiKey = p.aiKey.trim().slice(0, 500);
  if (typeof p.aiBaseUrl === 'string') {
    const u = p.aiBaseUrl.trim();
    if (u) { let url: URL; try { url = new URL(u); } catch { throw new Error('AI 接口地址无效'); }
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('AI 接口地址必须使用 HTTPS（本机 localhost 除外）');
      if (url.username || url.password) throw new Error('接口地址中不要包含账号密码'); }
    o.aiBaseUrl = u.slice(0, 500);
  }
  return o;
}

export const store = {
  settings(): Settings { const s = { ...defaults, ...readJson<Partial<Settings>>('settings.json', {}) }; s.aiKey = openSecret(s.aiKey) || sessionKey; return s; },
  saveSettings(s: Partial<Settings>): Settings {
    const n = { ...store.settings(), ...s };
    writeJson('settings.json', { ...n, aiKey: sealSecret(n.aiKey) });
    return n;
  },
  history(): Entry[] { return readJson<Entry[]>('history.json', []); },
  add(e: Entry) { const h = store.history(); h.unshift(e); writeJson('history.json', h); },
  update(id: string, patch: Partial<Entry>) { const h = store.history().map(e => e.id === id ? { ...e, ...patch } : e); writeJson('history.json', h); },
  remove(id: string) { writeJson('history.json', store.history().filter(e => e.id !== id)); },
};

/** Counts CJK characters individually and latin words as space-separated tokens. */
export function countWords(t: string): number {
  const cjk = (t.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = (t.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ').match(/[A-Za-z0-9'’-]+/g) || []).length;
  return cjk + latin;
}
