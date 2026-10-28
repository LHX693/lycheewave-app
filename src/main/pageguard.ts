import path from 'node:path';
import { fileURLToPath } from 'node:url';
// True only for file:// URLs inside `root` (our bundled pages). Uses fileURLToPath so Windows URLs
// (file:///C:/...) map to C:\... — URL.pathname gives "/C:/..." which never matched on Windows.
export function isPageUnder(root: string, u: string, p: typeof path = path): boolean {
  try {
    const x = new URL(u); if (x.protocol !== 'file:') return false;
    const win = p === path.win32 || (p === path && process.platform === 'win32');
    const f = p.resolve(fileURLToPath(x, { windows: win } as any)), r = p.resolve(root);
    const norm = (s: string) => (win ? s.toLowerCase() : s);
    return norm(f).startsWith(norm(r.endsWith(p.sep) ? r : r + p.sep));
  } catch { return false; }
}
