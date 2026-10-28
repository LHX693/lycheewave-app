#!/bin/bash
# Builds LycheeWave.app + dmg on a Mac. Usage: bash scripts/mac-build.sh [arm64|x64]  (run from project root)
set -euo pipefail
ARCH="${1:-arm64}"; VER=$(node -p "require('./package.json').version")
ROOT="$(pwd)"; WB="$HOME/lycheewave-build"; mkdir -p "$WB" vendor/bin vendor/models
echo "== whisper.cpp ($ARCH, static)"
[ -d "$WB/whisper.cpp" ] || git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$WB/whisper.cpp"
if [ "$ARCH" = arm64 ]; then OPTS="-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DCMAKE_OSX_ARCHITECTURES=arm64"; else OPTS="-DGGML_METAL=OFF -DCMAKE_OSX_ARCHITECTURES=x86_64 -DGGML_AVX=ON -DGGML_AVX2=OFF -DGGML_FMA=OFF -DGGML_F16C=ON"; fi
BD="$WB/whisper.cpp/build-$ARCH"
cmake -S "$WB/whisper.cpp" -B "$BD" -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_SDL2=OFF -DGGML_NATIVE=OFF -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 $OPTS >/dev/null
cmake --build "$BD" -j 8 --target whisper-cli >/dev/null
rm -f vendor/bin/*; cp "$BD/bin/whisper-cli" vendor/bin/whisper-cli
file vendor/bin/whisper-cli; echo "-- linked libs:"; otool -L vendor/bin/whisper-cli | tail -n +2
echo "== model"
[ -s vendor/models/ggml-base-q5_1.bin ] || curl -fL --retry 3 -o vendor/models/ggml-base-q5_1.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin
echo "== engine smoke test"
say -v Tingting "你好，欢迎使用荔枝波语音输入。今天下午三点开会。" -o "$WB/zh.aiff"
ffmpeg -loglevel error -y -i "$WB/zh.aiff" -ar 16000 -ac 1 -c:a pcm_s16le "$WB/zh.wav"
vendor/bin/whisper-cli -m vendor/models/ggml-base-q5_1.bin -f "$WB/zh.wav" -l zh -oj -of "$WB/zh-$ARCH" -np -t 6 >/dev/null 2>"$WB/zh.err" || tail -5 "$WB/zh.err"
python3 -c "import json;j=json.load(open('$WB/zh-$ARCH.json'));print('[engine]',''.join(s['text'] for s in j['transcription']))"
echo "== npm + package"
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund >/dev/null
if [ "$ARCH" = arm64 ]; then npm run pack:mac >/dev/null 2>"$WB/pack.err" || { tail -30 "$WB/pack.err"; exit 1; }; APP="dist/mac-arm64/LycheeWave.app"
else npm run pack:mac:x64 >/dev/null 2>"$WB/pack.err" || { tail -30 "$WB/pack.err"; exit 1; }; APP="dist/mac/LycheeWave.app"; fi
codesign --force --deep --sign - "$APP"; codesign --verify --deep --strict "$APP" && echo "codesign ok"
file "$APP/Contents/MacOS/LycheeWave" "$APP/Contents/Resources/bin/whisper-cli"
echo "== launch smoke test"
"$APP/Contents/MacOS/LycheeWave" >"$WB/run-$ARCH.log" 2>&1 & PID=$!; sleep 10
if kill -0 $PID 2>/dev/null; then echo "app running after 10s"; kill $PID; else echo "app exited:"; tail -20 "$WB/run-$ARCH.log"; fi
echo "== dmg"
STAGE="$WB/dmg-$ARCH"; rm -rf "$STAGE"; mkdir -p "$STAGE"; cp -R "$APP" "$STAGE/"; ln -s /Applications "$STAGE/Applications"
cp README.md "$STAGE/使用说明 README.md"
DMG="dist/LycheeWave-$VER-$ARCH.dmg"; rm -f "$DMG"
hdiutil create -volname "LycheeWave" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
cp "$DMG" "$HOME/Downloads/"; ls -la "$HOME/Downloads/LycheeWave-$VER-$ARCH.dmg"; shasum -a 256 "$DMG"
echo "APP=$APP"
