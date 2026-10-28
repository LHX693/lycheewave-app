export const RATE = 16000;

export function encodeWav(chunks: Int16Array[]): ArrayBuffer {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44; for (const c of chunks) { new Int16Array(buf, o, c.length).set(c); o += c.length * 2; }
  return buf;
}
export function floatToInt16(f: Float32Array): Int16Array {
  const o = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  return o;
}

/** Records one or more MediaStreams mixed to 16 kHz mono PCM. */
export class Recorder {
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private streams: MediaStream[] = [];
  private chunks: Int16Array[] = [];
  private started = 0;
  onLevel: (l: number) => void = () => {};

  async start(opts: { system?: boolean } = {}): Promise<{ system: boolean }> {
    this.chunks = [];
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    this.streams = [mic];
    let system = false;
    if (opts.system) {
      try {
        const d = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        d.getVideoTracks().forEach(t => t.stop());
        if (d.getAudioTracks().length) { this.streams.push(new MediaStream(d.getAudioTracks())); system = true; }
      } catch (e) { console.warn('system audio unavailable', e); }
    }
    this.ctx = new AudioContext({ sampleRate: RATE });
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    for (const s of this.streams) this.ctx.createMediaStreamSource(s).connect(this.node);
    this.node.onaudioprocess = ev => {
      const f = ev.inputBuffer.getChannelData(0);
      let peak = 0; for (let i = 0; i < f.length; i += 16) peak = Math.max(peak, Math.abs(f[i]));
      this.onLevel(peak);
      this.chunks.push(floatToInt16(f));
    };
    const sink = this.ctx.createGain(); sink.gain.value = 0;
    this.node.connect(sink); sink.connect(this.ctx.destination);
    this.started = performance.now();
    return { system };
  }
  get elapsed() { return this.started ? performance.now() - this.started : 0; }
  async stop(): Promise<{ wav: ArrayBuffer; durationMs: number }> {
    const durationMs = this.elapsed;
    this.node?.disconnect(); this.streams.forEach(s => s.getTracks().forEach(t => t.stop()));
    await this.ctx?.close(); this.ctx = null; this.started = 0;
    const wav = encodeWav(this.chunks); this.chunks = [];
    return { wav, durationMs };
  }
  cancel() { this.stop(); }
}

/** Decodes any Chromium-supported audio/video file to 16 kHz mono WAV. */
export async function decodeToWav(data: ArrayBuffer): Promise<{ wav: ArrayBuffer; durationMs: number }> {
  const tmp = new AudioContext();
  const audio = await tmp.decodeAudioData(data); await tmp.close();
  const len = Math.ceil(audio.duration * RATE);
  const off = new OfflineAudioContext(1, len, RATE);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const r = await off.startRendering();
  return { wav: encodeWav([floatToInt16(r.getChannelData(0))]), durationMs: audio.duration * 1000 };
}

export interface Seg { from: number; to: number; text: string }
const ts = (ms: number, sep: string) => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = Math.floor(ms % 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(x).padStart(3, '0')}`; };
export const toSrt = (s: Seg[]) => s.map((x, i) => `${i + 1}\n${ts(x.from, ',')} --> ${ts(x.to, ',')}\n${x.text}\n`).join('\n');
export const toMd = (title: string, s: Seg[], summary?: string) => `# ${title}\n\n${summary ? summary + '\n\n## 逐字稿\n\n' : ''}${s.map(x => `**[${ts(x.from, '.').slice(0, 8)}]** ${x.text}`).join('\n\n')}\n`;
export const clock = (ms: number) => ts(ms, '.').slice(0, 8);
