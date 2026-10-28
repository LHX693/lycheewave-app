#!/bin/bash
# Cross-builds the Windows x64 installer + zip on Linux (needs mingw-w64, cmake). Run from project root.
set -euo pipefail
WB="${WB:-$HOME/lycheewave-build}"; mkdir -p "$WB" vendor/bin vendor/models
[ -d "$WB/whisper.cpp" ] || git clone --depth 1 https://github.com/ggml-org/whisper.cpp "$WB/whisper.cpp"
cat > "$WB/mingw.cmake" <<'T'
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR x86_64)
set(CMAKE_C_COMPILER x86_64-w64-mingw32-gcc-posix)
set(CMAKE_CXX_COMPILER x86_64-w64-mingw32-g++-posix)
set(CMAKE_RC_COMPILER x86_64-w64-mingw32-windres)
set(CMAKE_FIND_ROOT_PATH /usr/x86_64-w64-mingw32)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
T
BD="$WB/whisper.cpp/build-win64"
cmake -S "$WB/whisper.cpp" -B "$BD" -G Ninja -DCMAKE_TOOLCHAIN_FILE="$WB/mingw.cmake" -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_SDL2=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
  -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
  -DCMAKE_EXE_LINKER_FLAGS="-static -static-libgcc -static-libstdc++" >/dev/null
cmake --build "$BD" --target whisper-cli >/dev/null
rm -f vendor/bin/*; cp "$BD/bin/whisper-cli.exe" vendor/bin/
x86_64-w64-mingw32-objdump -p vendor/bin/whisper-cli.exe | grep "DLL Name" | sort -u
[ -s vendor/models/ggml-base-q5_1.bin ] || curl -fL --retry 3 -o vendor/models/ggml-base-q5_1.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin
echo "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898  vendor/models/ggml-base-q5_1.bin" | sha256sum -c
cp "$WB/whisper.cpp/LICENSE" vendor/bin/whisper.cpp-LICENSE.txt
npm run pack:win
VER=$(node -p "require('./package.json').version")
command -v convert >/dev/null && convert assets/icon.png -define icon:auto-resize=256,128,64,48,32,16 "$WB/icon.ico" || python3 -c "from PIL import Image;Image.open('assets/icon.png').save('$WB/icon.ico',sizes=[(256,256),(64,64),(32,32),(16,16)])"
makensis -V2 -DVERSION="$VER" -DSRC="$(pwd)/dist/win-unpacked" -DICON="$WB/icon.ico" -DOUTFILE="$(pwd)/dist/LycheeWave-$VER-win-x64-setup.exe" scripts/installer.nsi
ls -la dist/*.exe dist/*.zip; sha256sum dist/*.exe dist/*.zip
