# LunaAgentOS 架构概览

[English](./architecture-overview.md)

LunaAgentOS 0.1 Preview 是真实 AI Agent 会话的中立桌面工作台。

它的架构使用统一 adapter contract 和 Runtime Session Model 连接外部 runtimes，观察真实 sessions，归一化过程可见性，并让 App 渲染活跃和归档工作。

## 分层

```text
┌──────────────────────────────────────────────┐
│               LunaAgentOS App                │
│       Neutral session workspace               │
├──────────────────────────────────────────────┤
│             Runtime Session Model            │
│       Session / Turn / Event / History        │
├──────────────────────────────────────────────┤
│             Adapter Host / Core              │
│ Discovery / lifecycle / routing / approval    │
├──────────────────────────────────────────────┤
│         Runtime Adapter / Plugin Contract     │
│ Manifest / capabilities / normalized events   │
├──────────────────────────────────────────────┤
│              Runtime Surfaces                 │
│      ACP / CLI / Gateway / IDE Bridge         │
├──────────────────────────────────────────────┤
│              External Runtimes               │
│        Claude Code / Hermes / Trae IDE        │
└──────────────────────────────────────────────┘
```

## Protocol 和 adapter contract

产品中心是 LunaAgentOS 与外部 Agent 产品之间的 contract。

这个 contract 覆盖：

- Adapter manifest。
- Capability declaration。
- Runtime targets 和 profiles。
- Runtime sessions 和 turns。
- 归一化 event stream。
- Tools、models、skills、MCP resources、permissions、routing metadata 和 history。

新增 Agent 产品沿着 adapter 路径进入：manifest、adapter implementation、归一化 runtime events，以及 App rendering。

## App

App 是协议的具体控制台，也是当前官方推荐的 LunaAgentOS 使用路径。

当前 App 是 [`apps/desktop-shell/`](../apps/desktop-shell/)（暂仅英文），它提供：

- 原生 Tauri 窗口。
- Agent Fleet 和配置。
- Runtime Session Cards。
- 活会话和归档会话。
- 本地历史和恢复动作。

App 渲染归一化 sessions 和 capabilities，同时 adapters 把 runtime 特有逻辑保留在 protocol contract 背后。

## Adapter Host / Core

Core 层负责面向 runtime 的职责：

- Adapter discovery 和 lifecycle。
- 通过 adapters 探测 runtime availability。
- Runtime process startup。
- Session prompt / load / resume / shutdown commands。
- 把归一化 event streaming 给 apps。
- 本地 history read/write/archive/delete。
- Windows / WSL / remote command routing。

## Runtime Surfaces

不同外部 agents 会暴露不同 surfaces。LunaAgentOS 把这些视为 adapters 背后的 runtime surfaces，而不是产品边界本身。

当前主 surface：

- **ACP / protocol**：用于结构化 runtime sessions 和 updates。

计划中的 runtime surfaces：

- **PTY / terminal**：用于原生 CLI/TUI 兼容。
- **Gateway / messaging**：用于后台和 channel-based agents。
- **SDK**：用于官方可编程 runtimes。
- **IDE Bridge**：用于 Trae IDE 这样的 IDE-first 产品。

## Registry adapters

### Claude Code

Claude Code 代表高价值 coding runtime。LunaAgentOS 把它建模为 registry adapter 和真实外部 runtime entry。

### Hermes

Hermes 代表基于 profile 的 runtime entries 和过程可见性。它的 ACP updates 可以暴露 thought、message、tool、plan 和 usage events。LunaAgentOS 把它建模为 registry adapter。

### Trae IDE

Trae IDE 是 IDE-first bridge adapter 路线。LunaAgentOS 让它作为真实 bridge entry 保持在 Agent Fleet 中可见。

## 方向

这套架构让控制层保持轻量，并让外部 agents 继续在 runtime 层保持强大。下一步架构工作遵循[产品定义](./product-definition.zh-CN.md)：protocol 定义 contract，adapters 连接外部 Agent 产品，Runtime Session Model 承载工作，App 让系统变得可用。
