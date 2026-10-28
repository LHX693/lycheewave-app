import zhCN from './zh-CN';
import en from './en';
import ja from './ja';

export type Key = keyof typeof zhCN;
export type Lang = 'zh-CN' | 'en' | 'ja';
export const LOCALES: Record<Lang, Record<Key, string>> = { 'zh-CN': zhCN, en, ja };
export const LANGS = Object.keys(LOCALES) as Lang[];
export const LANG_NAMES: Record<Lang, string> = { 'zh-CN': '简体中文', en: 'English', ja: '日本語' };

/** Explicit choice wins; otherwise follow the first system language (zh-* or ja-*), falling back to English. */
export function resolveLang(pref: string | undefined, system: readonly string[]): Lang {
  if (pref && (LANGS as string[]).includes(pref)) return pref as Lang;
  const s = (system[0] || '').toLowerCase();
  return s.startsWith('zh') ? 'zh-CN' : s.startsWith('ja') ? 'ja' : 'en';
}

let cur: Lang = 'en';
export const setLang = (l: Lang) => { cur = LOCALES[l] ? l : 'en'; };
export const getLang = () => cur;
export const intlLocale = () => (cur === 'ja' ? 'ja-JP' : cur === 'zh-CN' ? 'zh-CN' : 'en-US');
export function t(k: Key, vars?: Record<string, string | number>): string {
  let s = LOCALES[cur][k] ?? LOCALES.en[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b));
  return s;
}
