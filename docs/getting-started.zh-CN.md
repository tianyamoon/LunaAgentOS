# 快速开始

[English](./getting-started.md)

这份文档帮助你在本地运行当前的 LunaAgentOS 桌面应用。

## 跑起来之后你应该能看到什么

成功启动后，你应该可以：

- 把真实任务发给 Claude Code 或 Hermes，在 Runtime Session Card 中实时看到输出、思考流和 runtime 事件
- 看到左侧 Agent Fleet、中间 Runtime Session workspace、右侧 session list
- 在没有安装这些 runtime 时打开应用，看到每个入口显示明确的配置状态

## 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 CLI 相关依赖
- 如需 Claude entry：本机可用的 Claude Code
- 如需 Hermes entry：WSL + Hermes

Claude Code 和 Hermes 是让工作台真正有价值的 runtime 入口。没有安装时，LunaAgentOS 也可以启动，对应入口会显示明确的未配置状态，而不是崩溃或静默失败。

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

## 用真实 runtime session 验证

1. 启动 LunaAgentOS 应用。
2. 在 Agent Fleet 中选择 Claude Code 或 Hermes。
3. 从输入框发送一个小的真实任务。
4. 确认 Runtime Session Card 展示输出、runtime 活动和最终响应。
5. 确认该 session 出现在 session list 中，并可以从本地历史恢复。

如果两个 runtime 都没有安装，确认每个入口显示明确的未配置或不可用状态。这是预期的可解释状态，不是崩溃或报错。应用在 runtime 缺失时不会回退到 demo 路径。

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
