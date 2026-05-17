# LunaAgentOS Desktop Shell

## 目的

这是 LunaAgentOS 第一版桌面壳工程。

它的目标不是一步到位做完整产品，而是先把以下几件事坐实：

- 真实桌面壳存在
- Rust / Tauri 编译链已打通
- 最小控制台原型已经进入桌面工程
- 后续可以直接在这里继续推进第一版桌面应用

## 当前状态

当前已经完成：

- `Tauri 2` 工程初始化
- 控制台原型前端接入
- Windows 下 `Rust + MSVC` 编译链验证
- `--no-bundle` release 构建通过

## 当前可验证产物

可执行文件路径：

- `src-tauri/target/release/desktop-shell.exe`

## 本地运行

### 开发模式

双击运行：

- `run-tauri-dev.cmd`

### Release 构建（推荐）

双击运行：

- `run-tauri-build-nobundle.cmd`

### 完整 bundle 构建

双击运行：

- `run-tauri-build.cmd`

说明：

- 当前推荐优先用 `run-tauri-build-nobundle.cmd`
- 它更适合作为第一版可验证路径
- 完整 installer bundling 后续再补

## 当前原则

第一版桌面壳只做轻核心：

- 启动快
- 占用轻
- 状态可见
- 多 Agent 工作台方向明确

而不是一上来就做成重平台。
