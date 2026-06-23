# ADR 0007：Prompt Run 是 Turn 的流事件写入租约

## 状态

已接受

## 背景

ACP `session/update` 原生事件只稳定携带 Runtime Session 身份。桌面 Shell 曾根据当前 `activeTurnId` 猜测事件归属。当用户在上一轮输出尚未完全收尾时提交下一条输入，上一轮迟到包可能写入新 Turn，导致 Session Card 混入错误正文。

同一个原生 Runtime Session 也不应伪装成支持多个并发 Prompt Turn。用户仍然需要在执行中继续输入，但这些输入必须等待当前执行完成。

## 决策

1. LunaAgentOS 内部封装层为每次真实执行生成 `promptRunId`。
2. Runtime 流事件必须同时携带 `runtimeSessionId`、`turnId` 和 `promptRunId`。
3. `promptRunId` 是 Turn 的写入租约。已完成、失败、取消或身份不匹配的 Prompt Run 不得继续修改 Turn。
4. Runtime Session 同时最多执行一个 Prompt Run。
5. 运行中的新输入进入 FIFO Follow-up Queue。队列项真正开始执行时才创建 Turn。
6. 当前 Prompt Run 只有在成功完成后才自动启动下一条输入。失败、取消、停止、归档和删除不会静默发送后续输入。
7. 缺少 `promptRunId` 的旧历史标记为 `legacy_unverified`。保留原文并提示风险，不按文本相似度猜测修复。

## 结果

- 上一轮迟到包无法污染下一轮正文。
- 用户可以在长任务执行时继续提交后续输入。
- Session Card 可以明确展示最新 Turn、历史摘要和待处理队列。
- Adapter 协议语义保持不变；关联身份属于 LunaAgentOS 内部封装层。

## 非目标

- 不在一个 ACP Prompt Turn 上实现并发。
- 不自动改写旧历史正文。
- 不把 Runtime Session Card 扩展为 Task Board。
