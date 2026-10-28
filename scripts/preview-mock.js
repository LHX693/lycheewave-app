(() => { window.__noAnim = true;
  const now = Date.now(), D = 86400000, L = {};
  const t = ['今天下午三点和设计团队过一下首页改版，记得带上上周的数据。','Please send the Q4 report to the client before Friday.','帮我把会议纪要整理成三个要点，发到群里。','荔枝波的听写速度比打字快多了，真的很方便。','下周二上午十点约了供应商视频会议。'];
  const segs = [{from:0,to:4200,text:'好，我们开始今天的周会。'},{from:4200,to:9800,text:'先同步一下上线进度，安装包已经打好了。'},{from:9800,to:15100,text:'下周三之前完成权限引导的测试。'}];
  const hist = [];
  for (let i = 0; i < 26; i++) { const tx = t[i % 5]; hist.push({ id: 'e' + i, kind: i % 7 === 3 ? 'meeting' : i % 5 === 4 ? 'file' : 'dictation', title: tx.slice(0, 20), text: tx, segments: i % 7 === 3 ? segs : undefined, createdAt: now - Math.floor(i / 2.2) * D - i * 3e6, durationMs: 9000 + i * 900, words: 40 + (i * 37) % 160 }); }
  const settings = { hotkey: 'Alt+Space', model: 'ggml-base-q5_1.bin', language: 'auto', autoPaste: true, restoreClipboard: true, launchAtLogin: false, aiPolish: false, aiBaseUrl: '', aiKey: '', aiModel: 'gpt-4o-mini', onboarded: true };
  const models = [{file:'ggml-tiny-q5_1.bin',label:'Tiny（31 MB，最快）',installed:false},{file:'ggml-base-q5_1.bin',label:'Base（57 MB，推荐，已内置）',installed:true},{file:'ggml-small-q5_1.bin',label:'Small（181 MB，更准）',installed:false},{file:'ggml-large-v3-turbo-q5_0.bin',label:'Large v3 Turbo（547 MB，最准，较慢）',installed:false}];
  const p = v => Promise.resolve(v);
  window.lw = { history: () => p(hist), getSettings: () => p(settings), setSettings: s => p({ settings: { ...settings, ...s }, hotkeyOk: true }), models: () => p(models),
    permStatus: () => p({ mic: 'granted', screen: 'not-determined', accessibility: true, engine: true, model: true }),
    on: (ch, fn) => { (L[ch] = L[ch] || []).push(fn); return () => {}; }, toggleDictation: () => p() };
  window.__emit = (ch, ...a) => (L[ch] || []).forEach(f => f(...a));
  addEventListener('load', () => setTimeout(() => { window.__noAnim = true; const h = location.hash.slice(1); if (h && h !== 'indicator') __emit('nav', h);
    if (h === 'indicator') { __emit('indicator:state', 'recording', ''); } }, 100));
})();
