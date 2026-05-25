# LunaAgentOS 0.1 Preview 发布说明

[English](./release-notes-0.1-preview.md)

LunaAgentOS 0.1 Preview 是 Windows 优先的真实 AI Agent 会话中立桌面工作台。

这个 release 聚焦一个具体 workflow：选择 Claude Code 或 Hermes，运行真实 session，在 Runtime Session Card 中看到过程展开，并把结果留在本地历史中用于恢复或复盘。

范围有意保持小。LunaAgentOS 0.1 Preview 今天的价值是本地 session 工作台，而不是完整 orchestration 平台。

## What it is

- Windows 优先的真实 AI Agent 会话桌面工作台。
- 以可持续 Runtime Session Card 为中心的本地优先 app。
- 面向 Claude Code 和 Hermes runtime entry 的共享 session 界面。
- 外部 runtime 的中立工作台伙伴，而不是替代品。

## What works today

核心价值是真实的 runtime workflow：把任务发给真实 runtime，让过程保持可见，并把 session 保存在本地。

- **Claude Code 真实 runtime entry**：把任务发进 live Claude Code session，实时看到 output、thought 和 runtime events。
- **Hermes 真实 runtime entry**：使用 Windows / WSL ACP runtime instance 与 profile，thought、tool、plan、usage events 进入同一张 card 界面。
- **Runtime Session Cards**：跨多个 turn 把 output stream、thought stream、runtime events 和 final response 放在一起。
- **本地历史**：session turns 保存在本地 JSON 中。
- **恢复 / 归档**：从本地历史恢复 session，或以只读 archived transcript 打开。
- **Session list**：区分 live sessions 和 archived sessions，让当前工作和历史工作保持清楚边界。
- **语言切换**：zh-CN / en-US UI 语言选择会本地持久化。
- **Trae IDE bridge 方向**：保留为 IDE-first bridge path，不是 0.1 的主 runtime workflow。

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

- 已经使用 Claude Code 或 Hermes，并希望有一个更清楚桌面工作台来承载这些 session 的用户。
- 想评估真实 agent runtime 如何通过共享 session card 呈现、同时不隐藏过程的开发者。
- 希望在扩展更大范围 adapter 或协作能力之前，先打磨 runtime entries、本地历史、恢复行为和文档的贡献者。
- 想理解 adapter 方向，同时尊重当前 0.1 边界的集成方。

安装与运行细节见 [快速开始](./getting-started.zh-CN.md)。
