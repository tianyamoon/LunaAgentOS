# LunaAgentOS 桌面壳验证记录

## 当前状态

桌面壳已经进入真实工程阶段，不再只是静态原型。

当前已完成：

- 安装 `Rust / cargo`
- 安装 Windows `Visual C++ Build Tools`
- 初始化 `Tauri 2` 桌面工程
- 将 LunaAgentOS 最小控制台原型接入桌面壳前端
- 完成一次无 bundling 的 release 构建

## 可验证产物

当前已生成的可执行文件：

- `desktop-shell/src-tauri/target/release/desktop-shell.exe`

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
