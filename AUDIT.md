# LycheeWave 0.1.3 — 功能与安全审计

日期：2026-10-28（Asia/Taipei）· 平台：macOS arm64（Mac mini）· Electron 43.8.4
DMG：`~/Downloads/LycheeWave-0.1.3-arm64.dmg`，SHA-256 `f069c81619cc2719e5d39d2cecdc130dfcaf7f7d335957e63c67c490d830db3e`

## A. 功能测试（真实执行）
| 测试 | 环境 | 结果 |
|---|---|---|
| 单元测试 16 项（存储 CRUD、字数、SRT/MD 导出、设置持久化与校验、快捷键解析、AI 请求构造 + mock 服务器） | box, `npm test` | 16/16 通过 |
| tsc 类型检查、esbuild 打包 | box | 通过 |
| whisper-cli 引擎冒烟（zh/en） | Mac | 通过 |
| 打包 App 启动 8 秒存活 | Mac | 通过 |
| `--lw-selftest`（打包后的 App 内运行，临时 userData）共 21 项 | Mac | 21/21 通过，退出码 0 |
| ↳ 模型 SHA-256 与固定值一致 | | 通过 |
| ↳ 文件转写 WAV / MP3 / MP4 / M4A（`say`+ffmpeg 生成） | | 通过（中文样本识别为“你好,这是力之波的功能测试…”，“荔枝波”同音误识别属模型精度） |
| ↳ 会议路径：PCM 分块→WAV→whisper→历史→SRT/MD | | 通过 |
| ↳ 恶意文件名 `$(touch PWNED);-y \`id\`.mp3` | | 正常转写，未产生 PWNED 文件 |
| ↳ 路径/模型/设置/AI 地址的拒绝用例 | | 通过 |
| ↳ API Key 磁盘加密（safeStorage，`enc:v1:`） | | 通过 |
| ↳ 数据目录 0700，文件 0600；无临时音频残留 | | 通过 |
| ↳ 粘贴 | | 辅助功能未授权 → 按设计回退为留在剪贴板（未修改系统权限） |
| 模型 URL HEAD | Mac + box | 302 → HF CDN，可用 |
| Electron fuses（`@electron/fuses read`） | Mac | 符合预期 |

### 需要用户亲手测试
麦克风听写与权限弹窗；系统声音（屏幕录制权限）会议录音；真实自动粘贴（需授予辅助功能）；真实 AI 接口（自己的 Key）；GUI 交互流程；钥匙串弹窗行为；dmg 拖拽安装与首次打开（Gatekeeper）。

## B. 安全审查
已修复：
- **高** Electron 38.8.6 存在多项已公开漏洞（上下文隔离绕过等）→ 升级到受支持的 43.8.4，`npm audit` 0 漏洞（含开发依赖；electron-builder 26.18、esbuild 同步升级）。
- **高** IPC 未校验：file:read / transcribe 可读任意路径 → 绝对路径 + realpath + 扩展名白名单 + 常规文件 + 大小上限；文件保存仅取 basename；历史、设置、模型名、权限面板全部白名单校验。
- **高** ffmpeg 参数注入/协议滥用 → 参数数组（无 shell）、`-protocol_whitelist file`、`file:` 前缀、`-nostdin`、超时。
- **中** API Key 明文存储且回传渲染进程 → safeStorage 加密；渲染进程只收到掩码。
- **中** AI 请求：强制 HTTPS（仅 localhost 允许 http）、禁止重定向、60s 超时、错误信息中脱敏 Key。
- **中** 模型下载无完整性校验 → 仅已知模型、HTTPS、SHA-256 固定值校验，失败删除 `.part`。
- **中** 窗口加固：sandbox、contextIsolation、nodeIntegration=false、生产禁用 DevTools、禁止 window.open/导航/webview、严格 CSP、权限请求白名单（去掉 clipboard-read）、单实例。
- **中** Fuses：RunAsNode、NODE_OPTIONS、--inspect 关闭；asar 完整性校验与仅从 asar 加载开启。
- **低** 数据与临时文件权限 → 0700/0600，私有 mkdtemp 目录，退出清理。
- **低** 保存失败仍提示“已保存” → 修正。

剩余（未修复/需权衡）：
- **中** 仅 ad-hoc 签名，无 Hardened Runtime、无公证：首次打开需右键→打开；无法防篡改证明。需 Apple Developer ID。
- **低** 拖入的文件路径来自渲染进程，仅能靠类型/常规文件约束，非白名单。
- **低** CSP `style-src 'unsafe-inline'`（React 内联样式）。
- **低** 转写历史 history.json 明文（0600）。
- **低** 未授权辅助功能时文字留在剪贴板。
- **信息** Info.plist 含 electron-builder 默认的摄像头/蓝牙用途字符串（应用不使用）。
- 许可证：生产依赖 0 个；开发依赖均为 MIT/ISC/Apache/BSD/BlueOak 等宽松许可；whisper.cpp MIT；模型 MIT。

## 0.2.0 补充（2026-10-28）
- Electron 43.8.4，npm audit 0 漏洞。
- 修复：safeStorage 不可用时不再明文落盘 API Key，仅保存在内存（sessionKey）并提示。
- 修复：Info.plist 摄像头/蓝牙/音频采集权限说明改为准确中文。
- 自测：mac arm64 21/21；mac x64 21/21（Apple Silicon 上 Rosetta 运行，未在真 Intel Mac 测）；单元测试 16/16。
- Windows：wine 下 whisper-cli.exe 转写正确、打包 exe 自测核心项通过（修复前构建）；未在真实 Windows 测试；未签名（SmartScreen 警告）；exe 图标未嵌入。
- macOS 为 ad-hoc 签名，未公证（Gatekeeper 需右键打开）。

## 0.3.0 补充（2026-10-28）
- 界面多语言：简体中文 / English / 日本語（src/i18n），默认跟随系统语言、回退英文，设置中可即时切换并持久化；托盘/菜单/悬浮条/引导/错误提示/macOS 权限说明（InfoPlist.strings）均已本地化。
- 单元测试 21/21（含三语言 key 一致、占位符一致、系统语言解析、uiLang 白名单）；typecheck 通过；npm audit 0 漏洞。
- 打包自测（Apple 芯片 Mac）：arm64 21/21，x64（Rosetta）21/21；使用 `--use-mock-keychain` 运行，因为新的 ad-hoc 签名会触发钥匙串访问弹窗而阻塞无人值守测试——“API key 加密存储”一项因此是在模拟钥匙串上验证的。
- Windows：wine 下打包 exe 自测 14/15，唯一失败为 POSIX 权限位检查（Windows 不适用）；未在真实 Windows 测试。
