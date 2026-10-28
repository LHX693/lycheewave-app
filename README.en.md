[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

🌐 https://lhx693.github.io/lycheewave-app/

# LycheeWave

Local speech-to-text and meeting notes tool. Transcription runs on your machine with [whisper.cpp](https://github.com/ggml-org/whisper.cpp); audio is never uploaded. AI polishing/summaries are optional and require your own OpenAI-compatible endpoint and API key.

| Platform | Package | Status |
|---|---|---|
| macOS Apple Silicon (M1/M2/M3/M4) | `LycheeWave-0.3.0-arm64.dmg` | Tested on an Apple Silicon Mac |
| macOS Intel | `LycheeWave-0.3.0-x64.dmg` | Tested only under Rosetta on an Apple Silicon Mac |
| Windows 10/11 x64 | `LycheeWave-0.3.0-win-x64-setup.exe` / `LycheeWave-0.3.0-win-x64.zip` | Not tested on real Windows |

## Interface language
The UI is available in **简体中文 / English / 日本語**. It follows the system language by default (falling back to English) and can be switched instantly under **Settings → Interface language**; the tray menu, floating indicator, onboarding and macOS permission prompts are localized as well.

## macOS installation
1. Open the dmg (arm64 for Apple Silicon, x64 for Intel) and drag LycheeWave into Applications.
2. **First launch**: the app is ad-hoc signed and not notarized by Apple. In Applications, **right-click LycheeWave → Open → click "Open" again**.
   If you see "damaged / cannot be verified", go to the bottom of System Settings → Privacy & Security and click "Open Anyway", or run in Terminal:
   `xattr -dr com.apple.quarantine /Applications/LycheeWave.app`
3. Grant permissions in the onboarding screen: **Microphone** (required), **Accessibility** (auto-paste; restart the app if it doesn't take effect), **Screen & System Audio Recording** (optional, to record the other side in meetings).
4. Transcribing non-WAV audio/video files requires ffmpeg: `brew install ffmpeg`.

## Windows installation
1. Run `LycheeWave-0.3.0-win-x64-setup.exe`, or unzip the zip and run `LycheeWave.exe` directly.
2. The installer is **not code-signed**, so SmartScreen will show "Windows protected your PC": click **More info → Run anyway**. Some antivirus software may flag it falsely.
3. Default hotkey is `Ctrl + Shift + Space` (Alt+Space is reserved by Windows); change it in Settings. Auto-paste simulates `Ctrl+V` and needs no extra permission; it may not work in programs running as administrator.
4. Meeting system audio uses Windows loopback recording; if unavailable, only the microphone is recorded.
5. Transcribing non-WAV audio/video files requires ffmpeg: `winget install ffmpeg` (or put ffmpeg.exe on PATH).

## Usage (desktop)
- **Dictation**: press the hotkey in any app (macOS default `⌥ Space`) to start, press again to stop; text is pasted at the cursor and your clipboard is restored. `Alt+Esc` cancels.
- **History**: search, copy, delete, export; the home page shows today's word count and a 14-day chart.
- **File transcription**: drop in audio/video files and export TXT / MD / SRT.
- **Meeting notes**: records microphone + system audio (if available) and transcribes when done; with an AI endpoint configured it can generate a summary.
- Data directory: macOS `~/Library/Application Support/LycheeWave/`, Windows `%APPDATA%\LycheeWave\` (current-user-only permissions; the API key is encrypted with the system keychain/DPAPI).

## Build from source
Desktop (Electron + TypeScript + React, esbuild, electron-builder):
```
npm ci
npm test                          # unit tests
npm start                         # dev run (needs vendor/bin/whisper-cli and vendor/models/ggml-base-q5_1.bin)
bash scripts/mac-build.sh arm64   # on a Mac: build whisper.cpp, package, ad-hoc sign, create dmg
bash scripts/mac-build.sh x64     # Intel build (cross-compiled on an Apple Silicon Mac)
bash scripts/win-build.sh         # on Linux: cross-compile whisper.cpp with mingw-w64 and build the Windows installer and zip
```
Model files (`ggml-*.bin`) are not in the repo; the build scripts download them from Hugging Face and verify SHA-256.

See [AUDIT.md](AUDIT.md) for the security audit and test records.

## License
MIT © 2026 LHX693. whisper.cpp and the Whisper models are MIT licensed.
