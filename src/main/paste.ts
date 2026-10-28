import { clipboard, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** macOS needs Accessibility; Windows needs nothing extra. */
export const canAutoPaste = () => process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : process.platform === 'win32';

/** Puts text on the clipboard, sends Cmd+V to the frontmost app, then restores what was there. */
export async function pasteText(text: string, restore: boolean): Promise<boolean> {
  const saved = restore ? { text: clipboard.readText(), html: clipboard.readHTML(), rtf: clipboard.readRTF(), image: clipboard.readImage() } : null;
  clipboard.writeText(text);
  if (!canAutoPaste()) return false;
  await sleep(60);
  const ok = await new Promise<boolean>(res => process.platform === 'win32'
    // Fixed script (no user data in the command line): send Ctrl+V to the foreground window.
    ? execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', "(New-Object -ComObject WScript.Shell).SendKeys('^v')"], { windowsHide: true }, e => res(!e))
    : execFile('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'], e => res(!e)));
  if (restore) {
    await sleep(450);
    if (saved && clipboard.readText() === text) {
      clipboard.clear();
      const d: Electron.Data = {};
      if (saved.text) d.text = saved.text;
      if (saved.html) d.html = saved.html;
      if (saved.rtf) d.rtf = saved.rtf;
      if (!saved.image.isEmpty()) d.image = saved.image;
      if (Object.keys(d).length) clipboard.write(d);
    }
  }
  return ok;
}
