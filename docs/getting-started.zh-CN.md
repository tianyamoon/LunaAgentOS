# 快速开始

这份文档帮助你在本地运行当前的 LunaAgentOS 桌面应用。

## 跑起来之后你应该能看到什么

成功启动后，你应该可以：

- 打开 Tauri 桌面应用
- 看到左侧 Agent Fleet、中间 Runtime Session workspace、右侧 session list
- 从顶部进入非持久化 demo scene
- 在本机安装 Claude Code 或 Hermes 时，把真实任务发给这些 runtime

## 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 CLI 相关依赖
- 如需 Claude entry：本机可用的 Claude Code
- 如需 Hermes entry：WSL + Hermes

Claude Code 和 Hermes 都是外部 runtime。即使没有安装，LunaAgentOS 也可以启动，只是对应入口会显示为未配置或不可用。

## 安装前端依赖

```powershell
cd apps/desktop-shell
npm install
```

## 开发模式运行

```powershell
cd apps/desktop-shell
npm run tauri -- dev
```

## 构建轻量可执行文件

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

可执行文件路径：

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

轻量可执行文件是当前更推荐的本地验证路径。完整 installer 打包可以在后续把分发放到更高优先级时再补。

## 验证当前工作台

应用打开后，可以先检查这几个界面区域：

- 左侧：Agent Fleet 和配置状态
- 中间：Runtime Session workspace
- 右侧：活会话和归档会话

如果 Claude Code 或 Hermes 没有安装，对应入口也应该仍然可见，并明确显示不可用或未配置状态。

## 使用演示模式

1. 启动 LunaAgentOS 应用。
2. 点击顶部 demo 按钮。
   根据当前语言，按钮可能显示为 `演示场景` 或对应英文。
3. 工作台会加载一组受控的非持久化场景，其中包含 Claude Code 和 Hermes session card。
4. 点击清除 demo 的动作返回真实工作台。
   按钮可能显示为 `清除演示`。

这个 demo scene 只用于理解产品和截图，不会写入真实本地历史。

## 可选验证命令

桌面应用当前提供了一组聚焦测试脚本：

```powershell
cd apps/desktop-shell
npm run test:all
```

你也可以按模块运行定向检查，比如 `npm run test:runtime`、`npm run test:history` 或 `npm run lint:undef`。

## 当前产品形态

- Claude Code 和 Hermes 是今天真实可用的 runtime entries
- Trae IDE 是 IDE-first adapter path 的 bridge 目标
- 中间工作台围绕 Runtime Session Card 组织
- 右侧面板区分活会话和归档会话
- entry 与 session 之间的 call flow 属于下一层产品能力
