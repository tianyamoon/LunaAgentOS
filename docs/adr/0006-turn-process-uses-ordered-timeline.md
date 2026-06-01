# ADR 0006：Turn 过程使用有序 Timeline

## 状态

已接受

## 背景

早期 Runtime Session Card 把 Thinking、Assistant 和 Process 分别渲染到固定区域。这个结构适合静态分类，但会破坏执行期间的因果顺序：Assistant 片段可能被 Tool 打断，Permission 和 File Change 也应出现在它们真实发生的位置。

旧历史只有 `thoughts`、`outputs` 和 `logs` 聚合字段，无法恢复精确顺序。新 Runtime Event 已能按到达顺序保存更完整的过程。

## 决策

- Turn 使用 `timelineItems` 保存有序过程，类型包括 Thinking、Assistant、Tool、Permission、File Change、Runtime、Plan、Usage 和 Error。
- 运行中直接展示交叉 Timeline。Thinking 实时展开，Tool 默认紧凑，Permission 原地阻塞，Error 立即抬高对比度。
- 完成后默认折叠过程为 Worked for 摘要，最终 Assistant Markdown 成为视觉主体。
- 仅聚合相邻且标记为 `metadata.category = "explore"` 的低价值 Tool，不跨越其他事件。
- 旧历史只做近似重建，并明确标记“历史过程摘要”；不冒充精确回放。
- 原始 payload 和完整日志进入更深一层 Debug，不默认占据阅读路径。

## 后果

- Shell 不再按事件类型拼装固定面板。
- Adapter 只提供归一化 Runtime Event 和可选 metadata，不需要认识前端布局。
- History schema 无需升级：完整 Turn 已随 History Entry 持久化。
- `turnEvents.js` 与 `turnEventsView.js` 被删除，架构护栏阻止固定过程分区重新进入 Shell。
