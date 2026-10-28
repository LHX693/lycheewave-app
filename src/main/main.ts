import { secretStorageAvailable as store_secretOK } from './store';
import { app, BrowserWindow, globalShortcut, ipcMain, dialog, screen, systemPreferences, shell, session, desktopCapturer, Tray, Menu, nativeImage } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { store, countWords, Entry, Settings, cleanEntryPatch, cleanSettingsPatch } from './store';
import { transcribeWav, convertWithFfmpeg, joinSegments, listModels, downloadModel, whisperBin, Segment, privateTmp, cleanupTmp, checkMediaPath, isKnownModel, MODELS, MEDIA_EXT } from './whisper';
import { runSelfTest } from './selftest';
import { pasteText } from './paste';
import { aiReady, polish, summarize } from './ai';
import { t, setLang, getLang, resolveLang } from '../i18n';

// Lets getDisplayMedia return system audio (ScreenCaptureKit loopback) on macOS.
app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride');

let mainWin: BrowserWindow | null = null;
let indicator: BrowserWindow | null = null;
let tray: Tray | null = null;
let dictating = false;
let busy = false;
const out = (f: string) => path.join(__dirname, f);
const KEY_MASK = '__lw_saved_key__';
/** Settings as seen by the renderer: the API key itself never leaves the main process. */
const publicSettings = (s: Settings) => ({ ...s, aiKey: s.aiKey ? KEY_MASK : '', effectiveLang: getLang() });
const sysLangs = () => { try { const l = app.getPreferredSystemLanguages(); return l.length ? l : [app.getLocale()]; } catch { return [app.getLocale()]; } };
function applyLang() {
  const u = store.settings().uiLang;
  setLang(resolveLang(u === 'system' ? undefined : u, sysLangs()));
  if (tray) buildTrayMenu();
  if (app.isPackaged) buildAppMenu();
}
const secureWeb = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged, spellcheck: false } as const;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function createMain() {
  mainWin = new BrowserWindow({
    width: 1080, height: 720, minWidth: 860, minHeight: 560, title: 'LycheeWave', titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', autoHideMenuBar: true,
    backgroundColor: '#0b0b0d', icon: out('icon.png'),
    webPreferences: { preload: out('preload.js'), ...secureWeb },
  });
  mainWin.loadFile(out('index.html'));
  mainWin.on('close', e => { if (!(app as any).quitting) { e.preventDefault(); mainWin?.hide(); } });
}

function createIndicator() {
  indicator = new BrowserWindow({
    width: 200, height: 52, frame: false, transparent: true, resizable: false, movable: true, alwaysOnTop: true,
    focusable: false, skipTaskbar: true, hasShadow: false, show: false,
    webPreferences: { preload: out('preload.js'), ...secureWeb, backgroundThrottling: false },
  });
  indicator.setAlwaysOnTop(true, 'screen-saver');
  indicator.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  indicator.loadFile(out('indicator.html'));
}

function placeIndicator() {
  if (!indicator) return;
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  indicator.setPosition(Math.round(d.x + d.width / 2 - 100), Math.round(d.y + d.height - 90));
}

const broadcast = (ch: string, ...a: unknown[]) => BrowserWindow.getAllWindows().forEach(w => w.webContents.send(ch, ...a));
const indicatorState = (state: string, msg = '') => indicator?.webContents.send('indicator:state', state, msg);

async function toggleDictation() {
  if (busy) return;
  if (!dictating) {
    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      const ok = await systemPreferences.askForMediaAccess('microphone');
      if (!ok) { mainWin?.show(); broadcast('nav', 'onboarding'); return; }
    }
    dictating = true; placeIndicator(); indicator?.showInactive();
    indicatorState('recording'); indicator?.webContents.send('dictation:start');
  } else {
    dictating = false; busy = true; indicatorState('working');
    indicator?.webContents.send('dictation:stop');
  }
}

function registerHotkey(acc: string): boolean {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(acc, toggleDictation);
    globalShortcut.register('Alt+Escape', () => { if (dictating) { dictating = false; indicator?.webContents.send('dictation:cancel'); indicator?.hide(); } });
    return ok;
  } catch { return false; }
}

function writeTemp(buf: unknown): string {
  const b = buf instanceof ArrayBuffer ? Buffer.from(buf) : ArrayBuffer.isView(buf) ? Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength) : null;
  if (!b || b.length < 44 || b.length > 2 * 1024 ** 3 || b.toString('latin1', 0, 4) !== 'RIFF') throw new Error(t('err.badAudio'));
  const p = path.join(privateTmp(), 'lw-' + uid() + '.wav');
  fs.writeFileSync(p, b, { mode: 0o600 });
  return p;
}

async function runWhisper(wavBuf: unknown): Promise<Segment[]> {
  const s = store.settings();
  const wav = writeTemp(wavBuf);
  try { return await transcribeWav(wav, { model: s.model, language: s.language }); } finally { fs.rmSync(wav, { force: true }); }
}

ipcMain.handle('dictation:audio', async (_e, wavBuf: ArrayBuffer, durationMs: number) => {
  const s = store.settings();
  try {
    if (!Number.isFinite(durationMs)) durationMs = 0;
    if (durationMs < 300) { indicator?.hide(); return; }
    const raw = joinSegments(await runWhisper(wavBuf));
    if (!raw) { indicatorState('error', t('ind.noSpeech')); setTimeout(() => indicator?.hide(), 1200); return; }
    let text = raw;
    if (s.aiPolish && aiReady(s)) { indicatorState('working', t('ind.polishing')); try { text = await polish(s, raw) || raw; } catch (e) { console.warn(e); } }
    indicator?.hide();
    let pasted = false;
    if (s.autoPaste) pasted = await pasteText(text, s.restoreClipboard);
    else { const { clipboard } = await import('electron'); clipboard.writeText(text); }
    const entry: Entry = { id: uid(), kind: 'dictation', title: text.slice(0, 40), text, raw: raw !== text ? raw : undefined, createdAt: Date.now(), durationMs, words: countWords(text) };
    store.add(entry); broadcast('history:changed');
    if (s.autoPaste && !pasted) broadcast('toast', t('toast.copiedNoAx'));
  } catch (e: any) {
    indicatorState('error', String(e.message || e).slice(0, 60)); setTimeout(() => indicator?.hide(), 2500);
    broadcast('toast', String(e.message || e));
  } finally { busy = false; }
});

ipcMain.handle('transcribe:wav', async (_e, wavBuf: unknown) => runWhisper(wavBuf));
ipcMain.handle('transcribe:ffmpeg', async (_e, file: unknown) => {
  const wav = await convertWithFfmpeg(checkMediaPath(file));
  const s = store.settings();
  try { return await transcribeWav(wav, { model: s.model, language: s.language }); } finally { fs.rmSync(wav, { force: true }); }
});
ipcMain.handle('file:read', (_e, p: unknown) => { const b = fs.readFileSync(checkMediaPath(p, 1024 ** 3)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
ipcMain.handle('file:choose', async () => {
  const r = await dialog.showOpenDialog(mainWin!, { properties: ['openFile'], filters: [{ name: t('dlg.media'), extensions: MEDIA_EXT }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('file:save', async (_e, name: unknown, content: unknown) => {
  if (typeof name !== 'string' || typeof content !== 'string') throw new Error(t('err.badArgs'));
  // Only a bare file name is used as the suggestion; the user picks the real location in the dialog.
  const safe = path.basename(name).replace(/[\x00-\x1f]/g, '').slice(0, 120) || 'LycheeWave.txt';
  const r = await dialog.showSaveDialog(mainWin!, { defaultPath: path.join(app.getPath('documents'), safe) });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, content, 'utf8'); return true;
});

ipcMain.handle('history:list', () => store.history());
ipcMain.handle('history:add', (_e, raw: unknown) => {
  const e = cleanEntryPatch(raw);
  if (!e.kind || typeof e.text !== 'string') throw new Error(t('err.badArgs'));
  const entry: Entry = { title: '', durationMs: 0, ...e, kind: e.kind, text: e.text, id: uid(), createdAt: e.createdAt || Date.now(), words: countWords(e.text) };
  store.add(entry); broadcast('history:changed'); return entry;
});
ipcMain.handle('history:update', (_e, id: unknown, patch: unknown) => {
  if (typeof id !== 'string') throw new Error(t('err.badArgs'));
  const p = cleanEntryPatch(patch); if (p.text !== undefined) p.words = countWords(p.text);
  store.update(id, p); broadcast('history:changed');
});
ipcMain.handle('history:delete', (_e, id: unknown) => { if (typeof id !== 'string') throw new Error(t('err.badArgs')); store.remove(id); broadcast('history:changed'); });

ipcMain.handle('settings:get', () => publicSettings(store.settings()));
ipcMain.handle('settings:set', (_e, raw: unknown) => {
  const patch = cleanSettingsPatch(raw, MODELS.map(m => m.file));
  if (patch.aiKey === KEY_MASK) delete patch.aiKey;
  const prev = store.settings();
  const s = store.saveSettings(patch);
  if (patch.aiKey && !store_secretOK()) broadcast('toast', t('toast.keychain'));
  let hotkeyOk = true;
  if (patch.hotkey && patch.hotkey !== prev.hotkey) { hotkeyOk = registerHotkey(s.hotkey); if (!hotkeyOk) { store.saveSettings({ hotkey: prev.hotkey }); registerHotkey(prev.hotkey); } }
  if (patch.uiLang && patch.uiLang !== prev.uiLang) { applyLang(); broadcast('lang', getLang()); }
  if (patch.launchAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: s.launchAtLogin });
  return { settings: publicSettings(store.settings()), hotkeyOk };
});
ipcMain.handle('models:list', () => listModels());
ipcMain.handle('models:download', async (_e, file: unknown) => {
  if (!isKnownModel(file)) throw new Error(t('err.unknownModel')); await downloadModel(file, p => broadcast('models:progress', file, p)); return listModels(); });
ipcMain.handle('ai:summarize', (_e, text: unknown) => { if (typeof text !== 'string') throw new Error(t('err.badArgs')); const s = store.settings(); if (!aiReady(s)) throw new Error(t('err.needAi')); return summarize(s, text); });
ipcMain.handle('ai:polish', (_e, text: unknown) => { if (typeof text !== 'string') throw new Error(t('err.badArgs')); const s = store.settings(); if (!aiReady(s)) throw new Error(t('err.needAi')); return polish(s, text); });

ipcMain.handle('perm:status', () => ({
  platform: process.platform,
  mic: process.platform === 'linux' ? 'granted' : systemPreferences.getMediaAccessStatus('microphone'),
  screen: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
  accessibility: process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true,
  engine: !!whisperBin(),
  model: listModels().some(m => m.installed),
}));
ipcMain.handle('perm:mic', () => process.platform === 'darwin' ? systemPreferences.askForMediaAccess('microphone') : true);
ipcMain.handle('perm:accessibility', () => { if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true); return true; });
const PANES = ['Privacy_Microphone', 'Privacy_Accessibility', 'Privacy_ScreenCapture'];
ipcMain.handle('perm:open', (_e, pane: unknown) => { if (typeof pane !== 'string' || !PANES.includes(pane)) throw new Error(t('err.badArgs')); if (process.platform === 'win32') return shell.openExternal(pane === 'Privacy_Microphone' ? 'ms-settings:privacy-microphone' : 'ms-settings:privacy');
  if (process.platform !== 'darwin') return;
  return shell.openExternal('x-apple.systempreferences:com.apple.preference.security?' + pane); });
ipcMain.handle('dictation:toggle', () => toggleDictation());

function createTray() {
  const img = nativeImage.createFromPath(out('icon.png')).resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip('LycheeWave');
  buildTrayMenu();
}
function buildTrayMenu() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: t('tray.toggle'), click: toggleDictation },
    { label: t('tray.open'), click: () => mainWin?.show() },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => { (app as any).quitting = true; app.quit(); } },
  ]));
}
function buildAppMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { label: t('menu.window'), submenu: [{ role: 'minimize' }, { role: 'close' }] },
  ]));
}

// Lock down every web contents: no navigation, no new windows, no webviews, only our own file:// pages.
const isOwnPage = (u: string) => { try { const x = new URL(u); return x.protocol === 'file:' && path.resolve(decodeURIComponent(x.pathname)).startsWith(__dirname); } catch { return false; } };
app.on('web-contents-created', (_e, wc) => {
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (ev, url) => { if (!isOwnPage(url)) ev.preventDefault(); });
  wc.on('will-redirect', (ev, url) => { if (!isOwnPage(url)) ev.preventDefault(); });
  wc.on('will-attach-webview', ev => ev.preventDefault());
});

const SELFTEST = process.argv.includes('--lw-selftest');
if (SELFTEST) app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'lw-selftest-')));
if (!SELFTEST && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => mainWin?.show());

app.whenReady().then(async () => {
  if (SELFTEST) { await runSelfTest(); return; }
  applyLang();
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(isOwnPage(wc.getURL()) && ['media', 'display-capture', 'clipboard-sanitized-write'].includes(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => !!wc && isOwnPage(wc.getURL()) && ['media', 'display-capture', 'clipboard-sanitized-write'].includes(perm));
  store.saveSettings({}); // migrates a plaintext key to Keychain-backed encryption and tightens file modes
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    try { const [src] = await desktopCapturer.getSources({ types: ['screen'] }); cb({ video: src, audio: 'loopback' }); }
    catch { cb({}); }
  });
  createMain(); createIndicator(); createTray();
  const s = store.settings();
  if (!registerHotkey(s.hotkey)) mainWin?.webContents.once('did-finish-load', () => broadcast('toast', t('toast.hotkeyBusy', { k: s.hotkey })));
});
app.on('activate', () => mainWin?.show());
app.on('before-quit', () => { (app as any).quitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); cleanupTmp(); });
