import type { Settings } from './store';
import { t } from '../i18n';

/** Builds the OpenAI-compatible chat request. Pure, so it can be unit-tested. */
export function buildChatRequest(s: Pick<Settings, 'aiBaseUrl' | 'aiKey' | 'aiModel'>, system: string, user: string) {
  const base = new URL(s.aiBaseUrl.trim());
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) throw new Error(t('err.aiHttps'));
  const url = base.toString().replace(/\/+$/, '') + '/chat/completions';
  return {
    url,
    init: {
      method: 'POST',
      redirect: 'error' as const, // never forward the key to another host via redirect
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.aiKey },
      body: JSON.stringify({ model: s.aiModel, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    },
  };
}

export async function chat(s: Settings, system: string, user: string, timeoutMs = 60000): Promise<string> {
  const { url, init } = buildChatRequest(s, system, user);
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(t('err.aiHttp', { s: r.status, b: (await r.text()).slice(0, 200).split(s.aiKey).join('***') }));
  const j: any = await r.json();
  return String(j.choices?.[0]?.message?.content || '').trim();
}
export const aiReady = (s: Settings) => !!(s.aiBaseUrl && s.aiKey);

export const POLISH_PROMPT = 'You clean up dictated text. Remove filler words (嗯, 呃, 那个, um, uh, like), fix punctuation and obvious recognition errors, keep the original language and meaning. Do not add content. Reply with the cleaned text only.';
export const polish = (s: Settings, text: string) => chat(s, POLISH_PROMPT, text);
export const summarize = (s: Settings, text: string) => chat(s, t('ai.summaryPrompt'), text);
