[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

# LycheeWave 荔枝波

本地语音转文字与会议记录工具。转写在本机用 [whisper.cpp](https://github.com/ggml-org/whisper.cpp) 完成，不上传音频；AI 润色/摘要为可选功能，需自备 OpenAI 兼容接口和密钥。

| 平台 | 安装包 | 状态 |
|---|---|---|
| macOS Apple 芯片 (M1/M2/M3/M4) | `LycheeWave-0.3.0-arm64.dmg` | 已在 Apple 芯片 Mac 上实测 |
| macOS Intel | `LycheeWave-0.3.0-x64.dmg` | 仅在 Apple 芯片 Mac 的 Rosetta 下测试 |
| Windows 10/11 x64 | `LycheeWave-0.3.0-win-x64-setup.exe` / `LycheeWave-0.3.0-win-x64.zip` | 未在真实 Windows 上测试 |

## 界面语言
界面支持 **简体中文 / English / 日本語**。默认跟随系统语言（不支持的语言回退为英文），可在「设置 → 界面语言」中即时切换并保存；托盘菜单、悬浮指示条、权限引导与 macOS 权限弹窗说明也会随之本地化。

## macOS 安装
1. 打开 dmg（Apple 芯片选 arm64，Intel 选 x64），把 LycheeWave 拖到“应用程序”。
2. **首次打开**：本应用为 ad-hoc 自签名，没有经过 Apple 公证。请在“应用程序”里**右键点 LycheeWave → 打开 → 再点“打开”**。
   若提示“已损坏/无法验证”，到“系统设置 → 隐私与安全性”底部点“仍要打开”，或在终端执行：
   `xattr -dr com.apple.quarantine /Applications/LycheeWave.app`
3. 按引导页授权：**麦克风**（必需）、**辅助功能**（自动粘贴，打开后若不生效请重启应用）、**屏幕与系统录音**（可选，会议记录录对方声音）。
4. 非 WAV 的音视频文件转写需要 ffmpeg：`brew install ffmpeg`。

## Windows 安装
1. 运行 `LycheeWave-0.3.0-win-x64-setup.exe`，或解压 zip 后直接运行 `LycheeWave.exe`。
2. 安装包**没有代码签名**，SmartScreen 会提示“Windows 已保护你的电脑”：点 **更多信息 → 仍要运行**。部分杀毒软件可能误报。
3. 默认快捷键 `Ctrl + Shift + 空格`（Windows 上 Alt+空格 被系统占用），可在设置中修改。自动粘贴通过模拟 `Ctrl+V` 实现，无需额外授权；对以管理员身份运行的程序可能无效。
4. 会议记录的系统声音使用 Windows 回环录音；如不可用则只录麦克风。
5. 非 WAV 的音视频文件转写需要 ffmpeg：`winget install ffmpeg`（或将 ffmpeg.exe 放到 PATH）。

## 使用（桌面）
- **听写**：在任意应用里按快捷键（macOS 默认 `⌥ 空格`）开始，再按一次结束；文字粘贴到光标处后恢复原剪贴板。`Alt+Esc` 取消。
- **历史记录**：搜索、复制、删除、导出；首页显示今日字数和近 14 天图表。
- **文件转写**：拖入音频/视频文件，导出 TXT / MD / SRT。
- **会议记录**：录制麦克风 + 系统声音（如可用），结束后转写；配置 AI 接口后可生成摘要。
- 数据目录：macOS `~/Library/Application Support/LycheeWave/`，Windows `%APPDATA%\LycheeWave\`（权限仅当前用户，API 密钥用系统钥匙串/DPAPI 加密）。

## 从源码构建
桌面端（Electron + TypeScript + React，esbuild，electron-builder）：
```
npm ci
npm test                          # 单元测试
npm start                         # 开发运行（需要 vendor/bin/whisper-cli 和 vendor/models/ggml-base-q5_1.bin）
bash scripts/mac-build.sh arm64   # 在 Mac 上：编译 whisper.cpp、打包、ad-hoc 签名、生成 dmg
bash scripts/mac-build.sh x64     # Intel 版（在 Apple 芯片 Mac 上交叉编译）
bash scripts/win-build.sh         # 在 Linux 上：mingw-w64 交叉编译 whisper.cpp 并生成 Windows 安装包和 zip
```
模型文件（`ggml-*.bin`）不在仓库中，构建脚本会从 Hugging Face 下载并校验 SHA-256。

安全审计与测试记录见 [AUDIT.md](AUDIT.md)。

## 许可
MIT © 2026 LHX693。whisper.cpp 与 Whisper 模型为 MIT 许可。
