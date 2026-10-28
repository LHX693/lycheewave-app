import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Recorder, decodeToWav, toSrt, toMd, clock, Seg } from './audio';
import { t, setLang, intlLocale, Lang, LANGS, LANG_NAMES, Key } from '../i18n';
import { keyToAccel, hotkeyLabel } from './hotkey';

type Entry = { id: string; kind: 'dictation' | 'file' | 'meeting'; title: string; text: string; raw?: string; summary?: string; segments?: Seg[]; createdAt: number; durationMs: number; words: number };
type Settings = { hotkey: string; model: string; language: 'auto' | 'zh' | 'en' | 'ja'; uiLang: 'system' | Lang; effectiveLang: Lang; autoPaste: boolean; restoreClipboard: boolean; launchAtLogin: boolean; aiPolish: boolean; aiBaseUrl: string; aiKey: string; aiModel: string; onboarded: boolean };
type Page = 'home' | 'history' | 'file' | 'meeting' | 'settings' | 'onboarding';
const lw = window.lw;
const P: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  history: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13v4M12 11v6M15 14v3',
  meeting: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
};
const Icon = ({ n, s = 18 }: { n: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={P[n]} /></svg>;
function Num({ v }: { v: number }) {
  const [d, setD] = useState(0);
  useEffect(() => { if ((window as any).__noAnim) { setD(v); return; } let raf = 0; const st = performance.now(), from = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - st) / 250); setD(Math.round(from + (v - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [v]);
  return <>{d.toLocaleString(intlLocale())}</>;
}
export function Wave({ levels, active }: { levels: number[]; active: boolean }) {
  return <div className={'wave ' + (active ? 'on' : '')}>{levels.map((l, i) => <i key={i} style={{ transform: `scaleY(${active ? 0.08 + l * 0.92 : 0.08})` }} />)}</div>;
}
const kindLabel = (k: Entry['kind']) => t(('kind.' + k) as Key);
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const fmtTime = (t: number) => new Date(t).toLocaleString(intlLocale(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function useHistory() {
  const [items, setItems] = useState<Entry[]>([]);
  const load = useCallback(() => lw.history().then(setItems), []);
  useEffect(() => { load(); return lw.on('history:changed', load); }, [load]);
  return items;
}

function Home({ items, settings }: { items: Entry[]; settings: Settings }) {
  const today = dayKey(Date.now());
  const todayWords = items.filter(e => dayKey(e.createdAt) === today).reduce((a, e) => a + e.words, 0);
  const total = items.reduce((a, e) => a + e.words, 0);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    const k = dayKey(d.getTime());
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, words: items.filter(e => dayKey(e.createdAt) === k).reduce((a, e) => a + e.words, 0) };
  }), [items]);
  const max = Math.max(1, ...days.map(d => d.words));
  const minutes = Math.round(items.filter(e => e.kind === 'dictation').reduce((a, e) => a + e.durationMs, 0) / 60000);
  return (
    <div className="page">
      <h1>{t('home.title')}</h1>
      <p className="muted">{t('home.hintA')}<kbd>{hotkeyLabel(settings.hotkey)}</kbd>{t('home.hintB')}<kbd>⌥ Esc</kbd>{t('home.hintC')}</p>
      <div className="cards">
        <div className="card stat"><span>{t('home.today')}</span><b><Num v={todayWords} /></b></div>
        <div className="card stat"><span>{t('home.total')}</span><b><Num v={total} /></b></div>
        <div className="card stat"><span>{t('home.count')}</span><b><Num v={items.length} /></b></div>
        <div className="card stat"><span>{t('home.minutes')}</span><b><Num v={minutes} /></b></div>
      </div>
      <div className="card">
        <h3>{t('home.last14')}</h3>
        <svg className="chart" viewBox="0 0 700 170">
                    {[0, 1, 2, 3].map(i => <line key={i} x1={0} x2={700} y1={10 + i * 40} y2={10 + i * 40} className="gridline" />)}
          {days.map((d, i) => { const h = (d.words / max) * 120; return (
            <g key={i}><rect x={i * 50 + 18} y={130 - h} width={14} height={Math.max(h, 2)} rx={2} className={!d.words ? 'bar empty' : i === days.length - 1 ? 'bar today' : 'bar'} style={{ animationDelay: i * 8 + 'ms' }}><title>{t('common.wordsN', { n: d.words })}</title></rect>
              <text x={i * 50 + 25} y={155} textAnchor="middle">{d.label}</text></g>); })}
        </svg>
      </div>
      <div className="card">
        <h3>{t('home.recent')}</h3>
        {items.slice(0, 5).map(e => <div key={e.id} className="row"><span className="tag">{kindLabel(e.kind)}</span><span className="grow ellipsis">{e.text}</span><span className="muted">{fmtTime(e.createdAt)}</span></div>)}
        {!items.length && <p className="muted">{t('home.empty')}</p>}
      </div>
    </div>
  );
}

function History({ items, toast }: { items: Entry[]; toast: (s: string) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | Entry['kind']>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = items.filter(e => (kind === 'all' || e.kind === kind) && (!q || (e.text + (e.summary || '')).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="page">
      <h1>{t('nav.history')}</h1>
      <div className="toolbar">
        <input className="search" placeholder={t('hist.search')} value={q} onChange={e => setQ(e.target.value)} />
        <select value={kind} onChange={e => setKind(e.target.value as any)}><option value="all">{t('hist.all')}</option><option value="dictation">{t('kind.dictation')}</option><option value="file">{t('kind.file')}</option><option value="meeting">{t('kind.meeting')}</option></select>
      </div>
      {list.map(e => (
        <div key={e.id} className="card entry">
          <div className="row"><span className="tag">{kindLabel(e.kind)}</span><b className="grow ellipsis">{e.title}</b><span className="muted">{fmtTime(e.createdAt)} · {t('common.wordsN', { n: e.words })}</span></div>
          <p className={open === e.id ? 'text' : 'text clamp'} onClick={() => setOpen(open === e.id ? null : e.id)}>{e.text}</p>
          {open === e.id && e.summary && <pre className="summary">{e.summary}</pre>}
          <div className="actions">
            <button onClick={() => { navigator.clipboard.writeText(e.text); toast(t('common.copied')); }}>{t('common.copy')}</button>
            {e.segments && <ExportButtons title={e.title} segs={e.segments} text={e.text} summary={e.summary} />}
            <button className="danger" onClick={() => { if (confirm(t('hist.confirmDelete'))) lw.deleteHistory(e.id); }}>{t('common.delete')}</button>
          </div>
        </div>))}
      {!list.length && <p className="muted">{t('hist.noMatch')}</p>}
    </div>
  );
}

function ExportButtons({ title, segs, text, summary }: { title: string; segs: Seg[]; text: string; summary?: string }) {
  const safe = title.replace(/[\\/:*?"<>|\n]/g, ' ').slice(0, 40) || 'LycheeWave';
  return <>
    <button onClick={() => lw.saveFile(safe + '.txt', (summary ? summary + '\n\n' : '') + text)}>{t('export.as', { f: 'TXT' })}</button>
    <button onClick={() => lw.saveFile(safe + '.md', toMd(title, segs, summary))}>{t('export.as', { f: 'MD' })}</button>
    <button onClick={() => lw.saveFile(safe + '.srt', toSrt(segs))}>{t('export.as', { f: 'SRT' })}</button>
  </>;
}

function FilePage({ toast }: { toast: (s: string) => void }) {
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ title: string; segs: Seg[]; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const run = async (p: string) => {
    const name = p.split(/[\\/]/).pop() || p;
    setResult(null);
    try {
      let segs: Seg[]; let dur = 0;
      try {
        setStatus(t('file.decoding'));
        const { wav, durationMs } = await decodeToWav(await lw.readFile(p)); dur = durationMs;
        setStatus(t('file.transcribing', { d: clock(durationMs) }));
        segs = await lw.transcribeWav(wav);
      } catch (e) {
        setStatus(t('file.ffmpegFallback'));
        segs = await lw.transcribeFfmpeg(p);
        dur = segs.length ? segs[segs.length - 1].to : 0;
      }
      const text = segs.map(s => s.text).join('\n');
      setResult({ title: name, segs, text });
      await lw.addHistory({ kind: 'file', title: name, text, segments: segs, durationMs: dur });
      setStatus(t('file.done'));
    } catch (e: any) { setStatus(''); toast(t('err.transcribe', { e: e.message || e })); }
  };
  return (
    <div className="page">
      <h1>{t('nav.file')}</h1>
      <div className={'drop ' + (drag ? 'over' : '')} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) run(lw.pathForFile(f)); }}
        onClick={async () => { const p = await lw.chooseFile(); if (p) run(p); }}>
        <div className="big"><Icon n="upload" s={40} /></div><b>{t('file.drop')}</b><span className="muted">{t('file.dropSub')}</span>
      </div>
      {status && <p className="status">{status}</p>}
      {result && <div className="card">
        <div className="actions"><button onClick={() => { navigator.clipboard.writeText(result.text); toast(t('common.copied')); }}>{t('file.copyAll')}</button><ExportButtons title={result.title} segs={result.segs} text={result.text} /></div>
        <div className="segs">{result.segs.map((s, i) => <p key={i}><span className="ts">{clock(s.from)}</span>{s.text}</p>)}</div>
      </div>}
    </div>
  );
}

function Meeting({ settings, toast }: { settings: Settings; toast: (s: string) => void }) {
  const rec = useRef<Recorder | null>(null);
  const [state, setState] = useState<'idle' | 'rec' | 'work'>('idle');
  const [sys, setSys] = useState(true);
  const [gotSys, setGotSys] = useState(false);
  const [elapsed, setT] = useState(0);
  const [title, setTitle] = useState('');
  const [res, setRes] = useState<{ id: string; segs: Seg[]; text: string; summary?: string } | null>(null);
  const [lv, setLv] = useState<number[]>(Array(48).fill(0));
  useEffect(() => { const iv = setInterval(() => rec.current && setT(rec.current.elapsed), 500); return () => clearInterval(iv); }, []);
  const start = async () => {
    try { rec.current = new Recorder(); rec.current.onLevel = l => setLv(p => [...p.slice(1), Math.min(1, l * 2.4)]); const r = await rec.current.start({ system: sys }); setGotSys(r.system); setState('rec'); setRes(null);
      if (sys && !r.system) toast(t('meet.noSys')); }
    catch (e: any) { toast(t('meet.cantStart', { e: e.message || e })); }
  };
  const stop = async () => {
    if (!rec.current) return; setState('work');
    try {
      const { wav, durationMs } = await rec.current.stop(); rec.current = null;
      const segs: Seg[] = await lw.transcribeWav(wav);
      const text = segs.map(s => s.text).join('\n');
      const name = title || t('meet.defaultTitle', { d: new Date().toLocaleString(intlLocale(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
      const e = await lw.addHistory({ kind: 'meeting', title: name, text, segments: segs, durationMs });
      setRes({ id: e.id, segs, text });
    } catch (e: any) { toast(t('err.transcribe', { e: e.message || e })); }
    setState('idle');
  };
  const sum = async () => {
    if (!res) return;
    try { toast(t('meet.summarizing')); const s = await lw.summarize(res.text); setRes({ ...res, summary: s }); await lw.updateHistory(res.id, { summary: s }); }
    catch (e: any) { toast(String(e.message || e)); }
  };
  const aiOk = !!(settings.aiBaseUrl && settings.aiKey);
  return (
    <div className="page">
      <h1>{t('nav.meeting')}</h1>
      <div className="card meeting">
        <input placeholder={t('meet.titlePh')} value={title} onChange={e => setTitle(e.target.value)} disabled={state !== 'idle'} />
        <Wave levels={lv} active={state === 'rec'} />
        <label className="check"><input type="checkbox" checked={sys} onChange={e => setSys(e.target.checked)} disabled={state !== 'idle'} /> {t('meet.sysAudio')}</label>
        {state === 'idle' && <button className="primary big-btn" onClick={start}>{t('meet.start')}</button>}
        {state === 'rec' && <><div className="rec-time mono"><span className="dot" />{clock(elapsed)} {gotSys ? t('meet.micSys') : t('meet.micOnly')}</div><button className="primary big-btn" onClick={stop}>{t('meet.stop')}</button></>}
        {state === 'work' && <p className="status">{t('meet.working')}</p>}
      </div>
      {res && <div className="card">
        <div className="actions">
          <button onClick={sum} disabled={!aiOk} title={aiOk ? '' : t('meet.aiNeed')}>{t('meet.aiSummary')}</button>
          <button onClick={() => { navigator.clipboard.writeText(res.text); toast(t('common.copied')); }}>{t('common.copy')}</button>
          <ExportButtons title={title || t('nav.meeting')} segs={res.segs} text={res.text} summary={res.summary} />
        </div>
        {res.summary && <pre className="summary">{res.summary}</pre>}
        <div className="segs">{res.segs.map((s, i) => <p key={i}><span className="ts">{clock(s.from)}</span>{s.text}</p>)}</div>
      </div>}
    </div>
  );
}

function HotkeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rec, setRec] = useState(false);
  return <button className="hotkey" onClick={() => setRec(true)} onBlur={() => setRec(false)} onKeyDown={e => {
    if (!rec) return; e.preventDefault();
    const acc = keyToAccel(e);
    if (acc) { onChange(acc); setRec(false); }
  }}>{rec ? t('hotkey.press') : hotkeyLabel(value)}</button>;
}

function SettingsPage({ settings, save, toast }: { settings: Settings; save: (p: Partial<Settings>) => Promise<boolean>; toast: (s: string) => void }) {
  const [models, setModels] = useState<any[]>([]);
  const [prog, setProg] = useState<Record<string, number>>({});
  const [ai, setAi] = useState({ aiBaseUrl: settings.aiBaseUrl, aiKey: settings.aiKey, aiModel: settings.aiModel });
  useEffect(() => { lw.models().then(setModels); return lw.on('models:progress', (f: string, p: number) => setProg(x => ({ ...x, [f]: p }))); }, []);
  const dl = async (f: string) => { try { setProg(x => ({ ...x, [f]: 0 })); setModels(await lw.downloadModel(f)); } catch (e: any) { toast(String(e.message || e)); } setProg(x => { const n = { ...x }; delete n[f]; return n; }); };
  return (
    <div className="page">
      <h1>{t('nav.settings')}</h1>
      <div className="card form">
        <h3>{t('set.dictation')}</h3>
        <label>{t('set.uiLang')} <select value={settings.uiLang} onChange={e => save({ uiLang: e.target.value as any })}><option value="system">{t('set.uiLangSystem')}</option>{LANGS.map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></label>
        <label>{t('set.hotkey')} <HotkeyInput value={settings.hotkey} onChange={v => save({ hotkey: v })} /></label>
        <label>{t('set.recLang')} <select value={settings.language} onChange={e => save({ language: e.target.value as any })}><option value="auto">{t('set.auto')}</option><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>
        <label className="check"><input type="checkbox" checked={settings.autoPaste} onChange={e => save({ autoPaste: e.target.checked })} /> {t('set.autoPaste')}</label>
        <label className="check"><input type="checkbox" checked={settings.restoreClipboard} onChange={e => save({ restoreClipboard: e.target.checked })} /> {t('set.restoreClip')}</label>
        <label className="check"><input type="checkbox" checked={settings.launchAtLogin} onChange={e => save({ launchAtLogin: e.target.checked })} /> {t('set.login')}</label>
      </div>
      <div className="card form">
        <h3>{t('set.models')}</h3>
        {models.map(m => <div key={m.file} className="row">
          <input type="radio" name="model" checked={settings.model === m.file} disabled={!m.installed} onChange={() => save({ model: m.file })} />
          <span className="grow">{t(('model.' + m.file) as Key) || m.label}</span>
          {m.installed ? <span className="muted">{t('set.installed')}</span> : prog[m.file] !== undefined ? <span className="muted">{Math.round(prog[m.file] * 100)}%</span> : <button onClick={() => dl(m.file)}>{t('set.download')}</button>}
        </div>)}
        <p className="muted small">{t('set.modelNote')}</p>
      </div>
      <div className="card form">
        <h3>{t('set.ai')}</h3>
        <p className="muted small">{t('set.aiNote')}</p>
        <label>{t('set.aiUrl')} <input placeholder="https://api.openai.com/v1" value={ai.aiBaseUrl} onChange={e => setAi({ ...ai, aiBaseUrl: e.target.value })} /></label>
        <label>API Key <input type="password" placeholder="sk-…" value={ai.aiKey} onChange={e => setAi({ ...ai, aiKey: e.target.value })} /></label>
        <label>{t('set.aiModel')} <input value={ai.aiModel} onChange={e => setAi({ ...ai, aiModel: e.target.value })} /></label>
        <div className="actions"><button className="primary" onClick={async () => { if (await save(ai)) toast(t('common.saved')); }}>{t('common.save')}</button></div>
        <label className="check"><input type="checkbox" checked={settings.aiPolish} disabled={!settings.aiKey} onChange={e => save({ aiPolish: e.target.checked })} /> {t('set.aiPolish')}</label>
      </div>
    </div>
  );
}

function Onboarding({ done }: { done: () => void }) {
  const [st, setSt] = useState<any>({});
  const refresh = () => lw.permStatus().then(setSt);
  useEffect(() => { refresh(); const iv = setInterval(refresh, 1500); return () => clearInterval(iv); }, []);
  const Step = ({ ok, title, desc, children }: any) => <div className={'card step ' + (ok ? 'ok' : '')}><div className="check-dot">{ok ? '✓' : ''}</div><div className="grow"><b>{title}</b><p className="muted">{desc}</p></div>{!ok && children}</div>;
  return (
    <div className="page onboarding">
      <div className="hero"><img src="icon.png" width={84} /><h1>{t('ob.welcome')}</h1><p className="muted">{t('ob.sub')}</p></div>
      <Step ok={st.mic === 'granted'} title={t('ob.mic')} desc={t('ob.micDesc')}>
        <button className="primary" onClick={async () => { const ok = await lw.askMic(); if (!ok) lw.openPrefs('Privacy_Microphone'); refresh(); }}>{t('common.allow')}</button></Step>
      <Step ok={st.accessibility} title={t('ob.ax')} desc={t('ob.axDesc')}>
        <button className="primary" onClick={() => { lw.askAccessibility(); lw.openPrefs('Privacy_Accessibility'); }}>{t('common.openSettings')}</button></Step>
      <Step ok={st.screen === 'granted'} title={t('ob.screen')} desc={t('ob.screenDesc')}>
        <button onClick={() => lw.openPrefs('Privacy_ScreenCapture')}>{t('common.openSettings')}</button></Step>
      <Step ok={st.engine && st.model} title={t('ob.engine')} desc={st.engine ? (st.model ? t('ob.ready') : t('ob.needModel')) : t('ob.noEngine')} />
      <div className="actions center"><button className="primary big-btn" onClick={done}>{t('ob.start')}</button></div>
    </div>
  );
}

const Logo = () => <img src="icon.png" width={30} height={30} />;

function App() {
  const [page, setPage] = useState<Page>('home');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toastMsg, setToast] = useState('');
  const items = useHistory();
  const toast = useCallback((s: string) => { setToast(s); setTimeout(() => setToast(x => x === s ? '' : x), 3500); }, []);
  useEffect(() => { lw.getSettings().then((s: Settings) => { setLang(s.effectiveLang); setSettings(s); if (!s.onboarded) setPage('onboarding'); }); }, []);
  useEffect(() => { const a = lw.on('toast', toast); const b = lw.on('nav', (p: Page) => setPage(p)); const c = lw.on('lang', (l: Lang) => { setLang(l); setSettings(s => s && { ...s, effectiveLang: l }); }); return () => { a(); b(); c(); }; }, [toast]);
  const save = async (p: Partial<Settings>) => {
    try { const r = await lw.setSettings(p); setLang(r.settings.effectiveLang); setSettings(r.settings); if (!r.hotkeyOk) toast(t('toast.hotkeyFail')); return true; }
    catch (e: any) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); return false; }
  };
  if (!settings) return null;
  const nav: [Page, string, string][] = [['home', 'home', t('nav.home')], ['history', 'history', t('nav.history')], ['file', 'file', t('nav.file')], ['meeting', 'meeting', t('nav.meeting')], ['settings', 'settings', t('nav.settings')]];
  return (
    <div className="app" lang={settings.effectiveLang}>
      <aside>
        <div className="brand"><Logo /><span>Lychee<em>Wave</em></span></div>
        {nav.map(([k, i, l]) => <button key={k} className={'nav ' + (page === k ? 'active' : '')} onClick={() => setPage(k)}><Icon n={i} />{l}</button>)}
        <div className="grow" />
        <button className="dictate" onClick={() => lw.toggleDictation()}><span className="row0"><Icon n="mic" />{t('nav.dictate')}</span><kbd>{hotkeyLabel(settings.hotkey)}</kbd></button>
        <button className={'nav small ' + (page === 'onboarding' ? 'active' : '')} onClick={() => setPage('onboarding')}><Icon n="shield" s={15} />{t('nav.onboarding')}</button>
        <div className="ver mono">v{__LW_VERSION__} · {t('ver.local')}</div>
      </aside>
      <main>
        {page === 'home' && <Home items={items} settings={settings} />}
        {page === 'history' && <History items={items} toast={toast} />}
        {page === 'file' && <FilePage toast={toast} />}
        {page === 'meeting' && <Meeting settings={settings} toast={toast} />}
        {page === 'settings' && <SettingsPage settings={settings} save={save} toast={toast} />}
        {page === 'onboarding' && <Onboarding done={() => { save({ onboarded: true }); setPage('home'); }} />}
      </main>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
