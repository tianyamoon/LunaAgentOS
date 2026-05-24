# Hermes TUI 方向

[English](./hermes-tui-direction.md)

Hermes 在 LunaAgentOS 中的价值，不只是返回最终答案，而是让 runtime 工作过程保持鲜活可见。

## 产品方向

LunaAgentOS 中的 Hermes 关注可见过程，而不是 final-only output。

产品目标是：

> 让慢任务可见。

Hermes session card 保留 live TUI 的感受，同时使用桌面工作台提升可读性、持久性和控制能力。

## Card surface

Hermes card 优先呈现过程可见性：

- 当前 profile / runtime identity
- 当前任务
- Running state
- Thought stream
- Runtime/tool/plan/usage stream
- Output stream
- Final response

用户看到的是“hermes 正在工作”，而不是“app 卡住了”。

## Runtime event surface

Hermes ACP updates 可以映射到 LunaAgentOS card layers：

- `agent_thought_chunk`：thought stream
- `agent_message_chunk`：output stream
- `tool_call`：runtime stream
- `tool_call_update`：runtime stream
- `plan`：runtime plan update
- `usage_update`：runtime usage update

Desktop shell 监听 runtime session updates，并把它们追加到匹配的 session card。

## UI principle

Hermes 保持自己有价值的 runtime shape，同时 LunaAgentOS 围绕 Runtime Session Cards 归一化 workspace。

对 Hermes 来说，这意味着：

- 过程优先，最终答案其次。
- 可见 runtime state 优于静默空窗。
- Tool 和 plan events 要可见到足够有用。
- 降噪，但不隐藏工作过程。

## 下一步改进

- 更好的 event grouping 和 de-noising。
- 更清晰的 plan/tool/usage presentation。
- 更顺滑的长任务 session visibility。
- 更好的 Hermes profiles restore/reconnect feedback。

## 总结

Hermes 在 LunaAgentOS 中的价值是 live session：在一张 Runtime Session Card 中同时呈现可见过程、runtime state 和最终结果。
