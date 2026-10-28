[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

🌐 https://lhx693.github.io/lycheewave-app/

# LycheeWave

ローカル音声文字起こし・議事録ツールです。文字起こしは [whisper.cpp](https://github.com/ggml-org/whisper.cpp) によりお使いのマシン上で行われ、音声はアップロードされません。AI による整形・要約はオプション機能で、OpenAI 互換のエンドポイントと API キーをご自身で用意する必要があります。

| プラットフォーム | パッケージ | 状態 |
|---|---|---|
| macOS Apple シリコン (M1/M2/M3/M4) | `LycheeWave-0.3.0-arm64.dmg` | Apple シリコン Mac で実機テスト済み |
| macOS Intel | `LycheeWave-0.3.0-x64.dmg` | Apple シリコン Mac の Rosetta 上でのみテスト |
| Windows 10/11 x64 | `LycheeWave-0.3.1-win-x64-setup.exe` / `LycheeWave-0.3.1-win-x64.zip` | 実機の Windows では未テスト |

## 表示言語
UI は **简体中文 / English / 日本語** に対応しています。既定ではシステム言語に従い（非対応の言語は英語）、**設定 → 表示言語** で即座に切り替えて保存できます。トレイメニュー、フローティングインジケーター、初回ガイド、macOS の権限ダイアログの説明文も各言語に対応しています。

## macOS へのインストール
1. dmg を開き（Apple シリコンは arm64、Intel は x64）、LycheeWave を「アプリケーション」にドラッグします。
2. **初回起動**：本アプリは ad-hoc 署名で、Apple の公証を受けていません。「アプリケーション」で **LycheeWave を右クリック → 開く → もう一度「開く」** をクリックしてください。
   「壊れている／検証できない」と表示された場合は、「システム設定 → プライバシーとセキュリティ」の下部で「このまま開く」をクリックするか、ターミナルで次を実行します：
   `xattr -dr com.apple.quarantine /Applications/LycheeWave.app`
3. ガイド画面で権限を許可します：**マイク**（必須）、**アクセシビリティ**（自動ペースト。反映されない場合はアプリを再起動）、**画面とシステムオーディオの録音**（任意。会議で相手の音声を録音するため）。
4. WAV 以外の音声・動画ファイルの文字起こしには ffmpeg が必要です：`brew install ffmpeg`。

## Windows へのインストール
1. `LycheeWave-0.3.1-win-x64-setup.exe` を実行するか、zip を展開して `LycheeWave.exe` を直接実行します。
2. インストーラーは**コード署名されていない**ため、SmartScreen が「Windows によって PC が保護されました」と表示します：**詳細情報 → 実行** をクリックしてください。一部のウイルス対策ソフトが誤検知する場合があります。
3. 既定のショートカットは `Ctrl + Shift + Space`（Windows では Alt+Space がシステムに予約されています）で、設定で変更できます。自動ペーストは `Ctrl+V` のシミュレーションで行うため追加の権限は不要ですが、管理者として実行中のプログラムでは機能しない場合があります。
4. 議事録のシステム音声は Windows のループバック録音を使用します。利用できない場合はマイクのみ録音します。
5. WAV 以外の音声・動画ファイルの文字起こしには ffmpeg が必要です：`winget install ffmpeg`（または ffmpeg.exe を PATH に置く）。

## 使い方（デスクトップ）
- **音声入力**：任意のアプリでショートカット（macOS の既定は `⌥ Space`）を押して開始し、もう一度押して終了します。テキストはカーソル位置に貼り付けられ、元のクリップボードは復元されます。`Alt+Esc` でキャンセル。
- **履歴**：検索・コピー・削除・エクスポート。ホームに今日の文字数と直近 14 日間のグラフを表示します。
- **ファイル文字起こし**：音声・動画ファイルをドロップし、TXT / MD / SRT でエクスポートします。
- **議事録**：マイク＋システム音声（利用可能な場合）を録音し、終了後に文字起こしします。AI エンドポイントを設定すると要約を生成できます。
- データディレクトリ：macOS `~/Library/Application Support/LycheeWave/`、Windows `%APPDATA%\LycheeWave\`（現在のユーザーのみアクセス可能。API キーはシステムのキーチェーン／DPAPI で暗号化）。

## ソースからのビルド
デスクトップ版（Electron + TypeScript + React、esbuild、electron-builder）：
```
npm ci
npm test                          # ユニットテスト
npm start                         # 開発実行（vendor/bin/whisper-cli と vendor/models/ggml-base-q5_1.bin が必要）
bash scripts/mac-build.sh arm64   # Mac 上：whisper.cpp のビルド、パッケージ化、ad-hoc 署名、dmg 作成
bash scripts/mac-build.sh x64     # Intel 版（Apple シリコン Mac 上でクロスコンパイル）
bash scripts/win-build.sh         # Linux 上：mingw-w64 で whisper.cpp をクロスコンパイルし、Windows インストーラーと zip を作成
```
モデルファイル（`ggml-*.bin`）はリポジトリに含まれていません。ビルドスクリプトが Hugging Face からダウンロードし SHA-256 を検証します。

セキュリティ監査とテスト記録は [AUDIT.md](AUDIT.md) を参照してください。

## ライセンス
MIT © 2026 LHX693。whisper.cpp と Whisper モデルは MIT ライセンスです。
