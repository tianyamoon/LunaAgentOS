<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">LunaAgentOS</h1>

<p align="center">
  <a href="./README.md">English</a>
</p>

**LunaAgentOS 0.1 Preview**

LunaAgentOS 是真实 AI Agent 会话的中立桌面工作台。

它是 Windows 优先的应用，当前已经能直接用于 Claude Code 和 Hermes。选择一个 runtime 入口，把真实任务发进 live session，实时看到输出、thought 和 runtime 事件，并从本地历史回到这个会话。

这不是另一个聊天壳。LunaAgentOS 关注的是让真实 agent 进程保持可见、可持续、可恢复，同时不假装替代真正运行它们的外部工具。

![LunaAgentOS 桌面预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## 为什么做

AI Agent 已经足够承担真实工作，但它们的会话仍然散落在不同工具里：

- CLI、TUI、IDE、gateway、SDK 各自暴露不同部分。
- thought、tool、plan、usage、output、final response 很少稳定地待在同一个视图里。
- 会话历史分散在工具孤岛中，恢复、对比和复盘比任务本身还麻烦。

LunaAgentOS 把 session 本身做成产品界面。每个外部 Agent 仍然是自己的 runtime entry；桌面工作台为它们提供同一张 Runtime Session Card，承载输出、思考流、运行流、最终响应和本地历史。

## 当前能做什么

| 模块 | 状态 | 说明 |
|---|---:|---|
| LunaAgentOS App | 已可用 | 打开 Windows 优先的本地桌面工作台 |
| Claude Code | 已接入 | 把任务发进真实 Claude Code runtime session |
| Hermes | 已接入 | 使用 Windows / WSL ACP runtime instance 与 profile |
| Trae IDE | Bridge 路线 | 预留 IDE-first adapter 方向 |
| Runtime Session Card | 已可用 | 同屏查看输出流、思考流、运行流和最终响应 |
| 多会话工作台 | 已可用 | 切换发送目标，保留 live sessions，查看 archived sessions |
| 本地历史 | 已可用 | 恢复 JSON session history，或打开只读归档 |
| 界面语言 | 已可用 | zh-CN / en-US 本地持久化切换 |

## 快速开始

### 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 相关依赖
- 如需 Claude 入口：本机可用的 Claude Code
- 如需 Hermes 入口：WSL + Hermes

Claude Code 和 Hermes 是让工作台真正有价值的 runtime 入口。没有安装时，LunaAgentOS 也可以启动，对应入口会显示明确的未配置状态，而不是崩溃或静默失败。

### 运行应用

```powershell
cd apps/desktop-shell
npm install
npm run tauri -- dev
```

### 构建轻量可执行文件

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

可执行文件路径：

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

更详细的说明见：[docs/getting-started.zh-CN.md](./docs/getting-started.zh-CN.md)

## 产品边界

LunaAgentOS 0.1 Preview 当前是：

- 真实 AI Agent 会话的中立桌面工作台
- 面向 Claude Code 和 Hermes session 的 Windows 优先本地应用
- 以 Runtime Session Card 为中心的工作台
- 由 protocol、adapters 和 Runtime Session Model 支撑的产品界面

LunaAgentOS 0.1 Preview 当前不是：

- 试图把外部 runtime 全部收编成单一内置 Agent 的产品
- 完整的多 Agent orchestration 平台
- 要把所有 Agent 内部机制强行做成一样
- 现在就去做插件市场或商业平台

## 文档入口

### 先看这些

- [文档总览](./docs/README.zh-CN.md)
- [0.1 Preview 发布说明](./docs/release-notes-0.1-preview.zh-CN.md)
- [快速开始](./docs/getting-started.zh-CN.md)
- [当前产品边界](./docs/current-boundary.zh-CN.md)
- [贡献指南](./CONTRIBUTING.zh-CN.md)

### 产品与概念

- [产品定义（中文）](./docs/product-definition.zh-CN.md)
- [为什么做 LunaAgentOS（中文）](./docs/why-lunaagentos.zh-CN.md)
- [轻核心原则（中文）](./docs/light-core-principles.zh-CN.md)
- [路线图](./docs/roadmap.zh-CN.md)

### 架构与接入

- [架构概览](./docs/architecture-overview.zh-CN.md)
- [Hermes ACP Runtime](./docs/hermes-acp-profile-runtime.zh-CN.md)
- [Hermes TUI 方向](./docs/hermes-tui-direction.zh-CN.md)
- [Protocol](./protocol/README.md)（暂仅英文）
- [Adapters](./adapters/README.md)（暂仅英文）
- [Core](./core/README.md)（暂仅英文）
- [Apps](./apps/README.md)（暂仅英文）
- [Trae IDE Bridge](./bridges/trae-ide/README.md)（暂仅英文）

### 社区与政策

- [安全策略](./SECURITY.zh-CN.md)
- [商标与品牌使用说明](./TRADEMARKS.zh-CN.md)

### 英文入口

- [English README](./README.md)
- [English docs index](./docs/README.md)

## 许可证

本项目采用 [Apache-2.0](./LICENSE) 许可证。

## 贡献

当前最有价值的贡献方向：

- Claude Code / Hermes runtime 稳定性
- Runtime Session Card 的可用性和可读性
- Hermes thought / tool / plan / usage 事件体验
- 本地历史、恢复和错误态验证
- Trae IDE bridge 设计与接入
- 文档、截图和发布材料

开始前先看：[CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)
