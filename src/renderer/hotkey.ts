/** Converts a keydown into an Electron accelerator, or null if it isn't a valid combo. */
export function keyToAccel(e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; code: string }): string | null {
  const mods = [e.metaKey && 'Command', e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean) as string[];
  const k = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.code === 'Space' ? 'Space' : /^F\d+$/.test(e.code) ? e.code : null;
  return k && mods.length ? [...mods, k].join('+') : null;
}
import { t } from '../i18n';
const IS_MAC = typeof navigator === 'undefined' || /Mac/i.test(navigator.platform);
export const hotkeyLabel = (h: string) => !IS_MAC ? h.replace('CommandOrControl', 'Ctrl').replace('Control', 'Ctrl').replace('Command', 'Win').replace(/\+/g, ' + ').replace('Space', t('key.space')) : h.replace('Alt', '⌥').replace('CommandOrControl', '⌘').replace('Command', '⌘').replace('Control', '⌃').replace('Shift', '⇧').replace(/\+/g, ' ').replace('Space', t('key.space'));
