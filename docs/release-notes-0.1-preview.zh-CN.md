# LunaAgentOS 0.1 Preview 发布说明

[English](./release-notes-0.1-preview.md)

LunaAgentOS 0.1 Preview 是真实 AI Agent 会话的中立桌面工作台。

这个 preview 有意保持小范围。它聚焦于让真实 Claude Code 和 Hermes 会话在一个 Windows 优先的桌面工作台中可见、可恢复、可复盘。

## What it is

- Windows 优先的真实 AI Agent 会话桌面工作台。
- 以 Runtime Session Card 为中心的本地优先 app。
- 面向外部 runtime entries 的中立界面，而不是这些 runtime 的替代品。
- 由 protocol、adapters 和 Runtime Session Model 支撑的工作台体验。

## What works today

核心价值是真实的 session workflow：连接真实 runtime，看到 output 和 thought stream 实时到达 session card，并把本地历史留在一个地方。

- **Claude Code**：真实 runtime entry —— 发送任务，实时看到 output stream、thought stream 和 runtime events。
- **Hermes**：Windows / WSL ACP runtime instance 和 profile —— thought、tool、plan、usage events 通过同一张 card 界面流出。
- **Trae IDE**：被表达为 IDE-first bridge path。
- **Runtime Session Cards**：在同一界面跨多个 turn 展示 output stream、thought stream、runtime events 和 final response。
- **本地历史**：所有 runtime entry 的 session turns 均保存在本地 JSON 中。
- **恢复与归档**：会话可以从本地历史恢复，或以只读归档状态打开。
- 工作台在 session list 中区分 live sessions 和 archived sessions。
- UI 支持持久化的 zh-CN / en-US 语言切换。

## What is intentionally not in 0.1

- 不是 AionUi 的替代品。
- 不是 Claude Code 或 Hermes 的替代品。
- 不是完整的多 Agent orchestration 平台。
- 不是 marketplace 或大型商业平台。
- 不会把所有 Agent 内部机制强行做成一样。
- 不提供 Team Mode。
- 不把 remote entries 表达为 0.1 Preview 已可用能力。
- 不提供跨 Agent 的 shared memory bus。
- 不承诺任意第三方 adapter 都已经生产可用。

## Who this preview is for

- 希望用本地桌面工作台观察真实 AI Agent 会话的用户。
- 想评估 Claude Code 和 Hermes session 如何通过共享 session card 呈现的开发者。
- 希望在扩展更大范围 adapter 或协作能力之前，先打磨 runtime entries、本地历史、恢复行为和文档的贡献者。
- 想理解 adapter 方向，但不假设 LunaAgentOS 已经是完整 orchestration 平台的集成方。
