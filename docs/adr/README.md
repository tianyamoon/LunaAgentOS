# 架构决策记录

架构决策记录（Architecture Decision Records，ADR）用于保存 LunaAgentOS 中需要长期理解的决策。后续修改相关代码之前，应先阅读这些记录，避免反复推翻已经讨论清楚的取舍。

请先阅读 [领域上下文](../../CONTEXT.md)，了解统一领域词汇。

## 已接受的决策

- [0001：Adapter 层负责翻译而不同化](./0001-adapter-translates-without-homogenizing.md)
- [0002：Task 与 Runtime Session 保持分离](./0002-task-and-runtime-session-are-distinct.md)
- [0003：Workspace Focus 属于视图状态](./0003-workspace-focus-is-view-state.md)
- [0004：desktop Shell 的 main.js 只承担启动编排](./0004-main-js-is-bootstrap-orchestrator.md)
- [0005：架构静态检查保护模块边界](./0005-architecture-guard-enforces-module-boundaries.md)
- [0006：Turn 过程使用有序 Timeline](./0006-turn-process-uses-ordered-timeline.md)
- [0007：Prompt Run 是 Turn 的流事件写入租约](./0007-prompt-run-is-turn-write-lease.md)
- [0008：Runtime Session Card 使用连续 MessageList](./0008-runtime-session-card-uses-continuous-message-list.md)
