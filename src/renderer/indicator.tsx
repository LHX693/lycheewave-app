import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Recorder, clock } from './audio';
import { t, setLang, Lang } from '../i18n';

function Indicator() {
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');
  const [levels, setLevels] = useState<number[]>(Array(14).fill(0));
  const [elapsed, setT] = useState(0);
  const rec = useRef(new Recorder());
  const [, setL] = useState('');
  useEffect(() => { const ap = (l: Lang) => { setLang(l); setL(l); }; window.lw.getSettings().then((s: any) => ap(s.effectiveLang)); return window.lw.on('lang', ap); }, []);
  useEffect(() => {
    const r = rec.current;
    r.onLevel = l => setLevels(p => [...p.slice(1), Math.min(1, l * 2.2)]);
    const offs = [
      window.lw.on('indicator:state', (s: string, m: string) => { setState(s); setMsg(m); }),
      window.lw.on('dictation:start', async () => { try { await r.start(); } catch (e) { setState('error'); setMsg(t('ind.micUnavailable')); } }),
      window.lw.on('dictation:stop', async () => { const { wav, durationMs } = await r.stop(); await window.lw.dictationAudio(wav, durationMs); }),
      window.lw.on('dictation:cancel', () => r.cancel()),
    ];
    const iv = setInterval(() => setT(r.elapsed), 200);
    return () => { offs.forEach(o => o()); clearInterval(iv); };
  }, []);
  return (
    <div className={'pill ' + state}>
      <span className="seed" />
      {state === 'recording' && <div className="bars">{levels.map((l, i) => <i key={i} style={{ transform: `scaleY(${0.15 + l * 0.85})` }} />)}</div>}
      {state === 'recording' && <span className="time">{clock(elapsed).slice(3)}</span>}
      {state === 'working' && <span className="label">{msg || t('ind.transcribing')}</span>}
      {state === 'error' && <span className="label">{msg}</span>}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Indicator />);
