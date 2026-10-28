import { contextBridge, ipcRenderer, webUtils } from 'electron';
const inv = (ch: string) => (...a: unknown[]) => ipcRenderer.invoke(ch, ...a);
const api = {
  dictationAudio: inv('dictation:audio'), toggleDictation: inv('dictation:toggle'),
  transcribeWav: inv('transcribe:wav'), transcribeFfmpeg: inv('transcribe:ffmpeg'),
  readFile: inv('file:read'), chooseFile: inv('file:choose'), saveFile: inv('file:save'),
  pathForFile: (f: File) => webUtils.getPathForFile(f),
  history: inv('history:list'), addHistory: inv('history:add'), updateHistory: inv('history:update'), deleteHistory: inv('history:delete'),
  getSettings: inv('settings:get'), setSettings: inv('settings:set'),
  models: inv('models:list'), downloadModel: inv('models:download'),
  summarize: inv('ai:summarize'), polish: inv('ai:polish'),
  permStatus: inv('perm:status'), askMic: inv('perm:mic'), askAccessibility: inv('perm:accessibility'), openPrefs: inv('perm:open'),
  on: (ch: string, fn: (...a: any[]) => void) => { const l = (_e: unknown, ...a: any[]) => fn(...a); ipcRenderer.on(ch, l); return () => { ipcRenderer.removeListener(ch, l); }; },
};
contextBridge.exposeInMainWorld('lw', api);
export type Api = typeof api;
