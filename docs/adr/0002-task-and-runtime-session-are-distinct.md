# Task 与 Runtime Session 保持分离

Runtime Session 是一个可恢复、可观察、带历史的 runtime 工作上下文；Task 是未来可以拆分、分派和跨 Agent Entry 跟踪的工作单元。Runtime Session 只保存稳定的 `title`，Turn 保存用户 `prompt` 与实际发送的 `runtimePrompt`。Runtime Session Card 不能被建模为 Task 本身，也不能替代未来的 Task Board。

## Consequences

- Session Card 优化聚焦可读性、过程可见性、结果和恢复行为。
- `RuntimeSession.task` 与 `Turn.task` 不保留兼容字段，分别改为 `title` 与 `prompt`。
- Task 分解、Task Board 和自动分派属于后续 orchestration 层。
- 一个 Task 未来可以关联多个 Runtime Sessions；一个 Runtime Session 也可以承载多个 Turns。
