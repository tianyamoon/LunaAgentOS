# LunaAgentOS 0.1 Preview 发布说明

[English](./release-notes-0.1-preview.md)

LunaAgentOS 0.1 Preview 是真实 AI Agent 会话的中立桌面工作台。

这个 preview 有意保持小范围。它聚焦于让真实 Claude Code 和 Hermes 会话在一个 Windows 优先的桌面工作台中可见、可恢复、可复盘。

## What it is

- Windows 优先的真实 AI Agent 会话桌面工作台。
- 以 Runtime Session Card 为中心的本地优先 app。
- 面向外部 runtime entries 的中立界面，而不是这些 runtime 的替代品。
- 由 protocol、adapters 和 Runtime Session Model 支撑的产品体验。

## What works today

- Claude Code 可以作为真实 runtime entry 使用。
- Hermes 可以通过 Windows / WSL ACP runtime instance 和 profile 使用。
- Trae IDE 被表达为 IDE-first bridge path。
- Runtime Session Cards 在同一界面展示 output、thought、runtime events 和 final response。
- 工作台区分 active sessions 和 archived sessions。
- 本地 JSON history 保存 session turns。
- 已有 restore 和 read-only history states。
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
