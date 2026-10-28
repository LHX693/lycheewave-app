(function(){
var B='https://github.com/LHX693/lycheewave-app/releases/download/v0.3.0/';
var F={arm:['LycheeWave-0.3.0-arm64.dmg','190 MB'],intel:['LycheeWave-0.3.0-x64.dmg','195 MB'],win:['LycheeWave-0.3.0-win-x64-setup.exe','157 MB'],zip:['LycheeWave-0.3.0-win-x64.zip','195 MB']};
var T={
zh:{_title:'LycheeWave — 本地离线语音转文字',_img:'img/home-zh-CN.png',btn:{arm:'下载 macOS 版（Apple 芯片）',intel:'下载 macOS 版（Intel）',win:'下载 Windows 版'},other:'不是这台电脑？'},
en:{_title:'LycheeWave — Offline speech-to-text',_img:'img/home-en.png',btn:{arm:'Download for Mac (Apple silicon)',intel:'Download for Mac (Intel)',win:'Download for Windows'},
skip:'Skip to content','nav.features':'Features','nav.install':'Install','hero.tag':'v0.3.0 · Free & open source · MIT','hero.title':'Say it. It’s written.','hero.lead':'Hold a hotkey, speak, let go — the text appears at your cursor. Transcription runs entirely on your computer, offline. Audio never leaves it.','hero.other':'Other builds: ','p.arm':'Mac Apple silicon','p.intel':'Mac Intel','p.win':'Windows installer','p.zip':'Windows portable',
'f.h':'Four things, done well','f1.t':'Hold to talk','f1.d':'In any app, hold the hotkey and speak. On release the text is pasted at the cursor and your clipboard is restored.','f2.t':'File transcription','f2.d':'Drop in an audio or video file and get timestamped text you can export.','f3.t':'Meeting notes','f3.d':'Record your mic and system audio together, and get a full transcript afterwards.','f4.t':'History','f4.d':'Every transcription stays on your device — searchable, copyable, deletable.',
'p.h':'Private by default','p.d':'Speech recognition runs on a bundled whisper.cpp model on your machine and works with no network. Optional AI polishing uses your own OpenAI-compatible API key, stored encrypted in the system keychain.','x1.v':'audio files uploaded','x2.v':'UI languages: 中文 / English / 日本語','x3.v':'licensed, auditable code',
'i.h':'Install in three steps','m1.t':'Open the disk image','m1.d':'Double-click the LycheeWave .dmg in your Downloads folder.','m2.t':'Drag to Applications','m2.d':'Drag the LycheeWave icon onto the Applications folder.','m3.t':'First launch','m3.d':'The build isn’t notarized yet: right-click LycheeWave in Applications, choose Open, then click Open in the dialog. Only needed once.','w1.t':'Run the installer','w1.d':'Double-click setup.exe, or unzip the portable build and run LycheeWave.exe.','w2.t':'Get past SmartScreen','w2.d':'The installer isn’t signed yet. If a blue warning appears, click More info, then Run anyway.','w3.t':'Start dictating','w3.d':'Open LycheeWave from the Start menu and allow microphone access.',
's.h':'Your first dictation','s1.t':'Allow the microphone','s1.d':'So LycheeWave can hear you. Sound is processed locally only.','s2.t':'Allow Accessibility (macOS)','s2.d':'For the global hotkey and to paste text into other apps.','s3.t':'Hold, speak, release','s3.d':'Text lands at your cursor. The app walks you through this on first launch.',
'h.h':'Need help?','h.d':'Open an issue on GitHub, or check the checksum file to verify your download.','h.issue':'Open an issue →','h.notes':'Release notes →','req':'macOS 12 or later (Apple silicon / Intel) · Windows 10/11 x64 · Version 0.3.0',other:'Not this computer?'},
ja:{_title:'LycheeWave — オフライン音声入力',_img:'img/home-ja.png',btn:{arm:'Mac 版をダウンロード（Apple シリコン）',intel:'Mac 版をダウンロード（Intel）',win:'Windows 版をダウンロード'},
skip:'本文へ','nav.features':'機能','nav.install':'インストール','hero.tag':'v0.3.0 · 無料・オープンソース · MIT','hero.title':'話せば、もう書けている。','hero.lead':'ショートカットを押しながら話し、離すとカーソル位置に文字が入ります。文字起こしはすべてお使いのコンピュータ上でオフライン処理。音声は外部に送信されません。','hero.other':'その他のビルド：','p.arm':'Mac Apple シリコン','p.intel':'Mac Intel','p.win':'Windows インストーラー','p.zip':'Windows ポータブル版',
'f.h':'4 つのことを、きちんと','f1.t':'押して話す','f1.d':'どのアプリでもショートカットを押しながら話すだけ。離すとカーソル位置に貼り付けられ、クリップボードは元に戻ります。','f2.t':'ファイル文字起こし','f2.d':'音声・動画ファイルをドロップすると、タイムスタンプ付きテキストを書き出せます。','f3.t':'会議メモ','f3.d':'マイクとシステム音声を同時に録音し、終了後に全文テキストを作成。','f4.t':'履歴','f4.d':'すべての文字起こしは端末内に保存され、検索・コピー・削除できます。',
'p.h':'プライバシーが標準','p.d':'音声認識は同梱の whisper.cpp モデルで端末上で実行され、ネットがなくても動きます。任意の AI 整形にはご自身の OpenAI 互換 API キーを使い、キーはシステムのキーチェーンに暗号化保存されます。','x1.v':'アップロードされる音声','x2.v':'UI 言語：中文 / English / 日本語','x3.v':'ライセンス、監査可能なコード',
'i.h':'3 ステップでインストール','m1.t':'ディスクイメージを開く','m1.d':'「ダウンロード」フォルダの LycheeWave .dmg をダブルクリック。','m2.t':'アプリケーションへドラッグ','m2.d':'LycheeWave アイコンを Applications フォルダへドラッグ。','m3.t':'初回起動','m3.d':'まだ公証されていないため、アプリケーション内の LycheeWave を右クリックして「開く」を選び、ダイアログでも「開く」をクリック。初回のみです。','w1.t':'インストーラーを実行','w1.d':'setup.exe をダブルクリック、またはポータブル版 zip を展開して LycheeWave.exe を実行。','w2.t':'SmartScreen を通過','w2.d':'未署名のため青い警告が出たら「詳細情報」→「実行」をクリック。','w3.t':'使い始める','w3.d':'スタートメニューから LycheeWave を開き、マイクへのアクセスを許可します。',
's.h':'はじめての音声入力','s1.t':'マイクを許可','s1.d':'声を聞き取るためです。音声は端末内でのみ処理されます。','s2.t':'アクセシビリティを許可（macOS）','s2.d':'グローバルショートカットと、他のアプリへの貼り付けに使います。','s3.t':'押して、話して、離す','s3.d':'文字がカーソル位置に入ります。初回起動時にアプリが案内します。',
'h.h':'お困りですか？','h.d':'GitHub で Issue を作成するか、チェックサムでダウンロードを確認してください。','h.issue':'Issue を作成 →','h.notes':'リリースノート →','req':'macOS 12 以降（Apple シリコン / Intel）· Windows 10/11 x64 · バージョン 0.3.0',other:'別のコンピュータ？'}};
var zh={};document.querySelectorAll('[data-i18n]').forEach(function(e){zh[e.dataset.i18n]=e.textContent});
var os=/Win/.test(navigator.platform+navigator.userAgent)?'win':'arm';
// Apple silicon vs Intel: try WebGL renderer hint; default to Apple silicon
if(os==='arm'){try{var g=document.createElement('canvas').getContext('webgl'),d=g&&g.getExtension('WEBGL_debug_renderer_info'),r=d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'';if(/Intel/i.test(r))os='intel'}catch(e){}}
var lang;
function set(l){lang=l;var t=T[l];document.documentElement.lang={zh:'zh-CN',en:'en',ja:'ja'}[l];document.title=t._title;
document.querySelectorAll('[data-i18n]').forEach(function(e){var k=e.dataset.i18n;e.textContent=(l==='zh'?zh[k]:t[k])||zh[k]});
document.querySelectorAll('[data-lang]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.lang===l)});
document.getElementById('hero-img').src=t._img;prim();try{localStorage.lw=l}catch(e){}}
function prim(){var f=F[os];var a=document.getElementById('primary');a.href=B+f[0];
document.getElementById('primary-label').textContent=T[lang].btn[os==='zip'?'win':os];document.getElementById('primary-meta').textContent=f[0]+' · '+f[1]}
document.querySelectorAll('[data-dl]').forEach(function(a){a.href=B+F[a.dataset.dl][0]});
document.querySelectorAll('[data-lang]').forEach(function(b){b.onclick=function(){set(b.dataset.lang)}});
function tab(o){document.querySelectorAll('[role=tab]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.os===o)});document.querySelectorAll('.steps').forEach(function(s){s.hidden=s.dataset.os!==o})}
document.querySelectorAll('[role=tab]').forEach(function(b){b.onclick=function(){tab(b.dataset.os)}});
tab(os==='win'?'win':'mac');
var q=new URLSearchParams(location.search).get('lang'),s;try{s=localStorage.lw}catch(e){}
var n=(navigator.language||'').slice(0,2);set(T[q]?q:T[s]?s:(n==='ja'?'ja':n==='en'?'en':'zh'));
})();
