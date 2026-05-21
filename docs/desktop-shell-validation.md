# LunaAgentOS 桌面壳验证记录

## 当前状态

桌面壳已经进入真实工程阶段，不再只是静态原型。

当前已完成：

- 安装 `Rust / cargo`
- 安装 Windows `Visual C++ Build Tools`
- 初始化 `Tauri 2` 桌面工程
- 将 LunaAgentOS 最小控制台原型接入桌面壳前端
- 完成一次无 bundling 的 release 构建
- 接入 `Claude Code CLI` 的真实运行时探测与非交互事件流调用
- 探测到 `WSL Hermes` 真实运行时，并接入 Hermes ACP 会话事件流
- 增加本地 runtime 配置文件，允许用户覆盖 Claude / Hermes 的默认启动方式
- 将本地历史存储拆分为 `history/live/` 与 `history/archive/`，并兼容旧的 `history/*.json`
- 将启动流程收敛为“首屏先起、历史后台加载、运行时显式刷新”
- 将任务发送改为“卡片先入场、CLI 后台运行、不阻塞继续操作”
- 将占位交互从弹窗提示改为状态条反馈

## 可验证产物

当前已生成的可执行文件：

- `desktop-shell/src-tauri/target/release/desktop-shell.exe`

## 当前真实运行时状态

### Claude Code

当前状态：

- 已安装并可调用
- `claude --version` 可返回版本
- `claude -p --verbose --output-format stream-json` 已可返回真实结构化事件流

这意味着当前桌面壳中的 `Claude Code` 不再只是静态样例位，而是已经具备真实运行时接线。

### Hermes

当前状态：

- 在 `WSL` 中已探测到真实运行时
- 已确认 `hermes --version` 可返回
- 已通过 ACP runtime 链路承接任务，并将 `session/update` 过程事件进入会话卡片
- 允许通过本地 runtime 配置覆盖 Hermes host / executable

这意味着 Hermes 不再只是占位入口，而是 Stage 1 最小异构工作台的真实运行时入口之一。

## 当前启动与静默体验

当前首屏行为已经收敛为：

- 先渲染左侧舰队、中间工作台和右侧历史区骨架
- 历史任务在后台异步读取
- 不在启动时自动拉起真实 `Claude` 会话
- 运行时探测只由 `刷新状态` 按钮显式触发

当前交互行为已经收敛为：

- `发送` / `发给主 Agent` 会先让卡片入场
- 真实 CLI 调用在后台进行
- 顶部状态条负责提示“刷新中 / 运行中 / 已完成 / 出错”
- 占位按钮不再通过 `alert` 弹窗打断体验

## 为什么使用 no-bundle 验证

完整 `tauri build` 在当前环境中已经把应用本体编译成功，但在 MSI bundling 阶段遇到全局超时。

因此当前第一版以更轻、更稳定的验证路径为准：

- 先确认 `desktop-shell.exe` 能稳定产出
- 再视需要补 installer / bundling

这符合 LunaAgentOS 第一版“先轻、先能用、先可参与”的原则。

## 当前可用命令

### 开发模式

- `desktop-shell/run-tauri-dev.cmd`

### Release 构建（无 bundle）

- `desktop-shell/run-tauri-build-nobundle.cmd`

### Release 构建（完整 bundle）

- `desktop-shell/run-tauri-build.cmd`

说明：

- 当前推荐先使用 `run-tauri-build-nobundle.cmd`
- 它能更稳定地产出第一版可执行文件

## 当前意义

这一步的重要性不是“已经有完整桌面产品”，而是：

- 技术路线已从纸面进入真实桌面工程
- Rust / Tauri 编译链已打通
- 控制台原型已真正进入桌面壳
- 参与者醒来后看到的是“可继续接着做”的产物，而不是概念
