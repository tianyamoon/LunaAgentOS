# 0008：Runtime Session Card 使用连续 MessageList

## 状态

已接受

## 背景

Runtime Session Card 曾经把每个 Turn 渲染为可见的“第 N 轮”容器，再在容器中套入 Thinking、Tool、Assistant 和 Debug 区域。这个结构虽然保留了过程信息，但会把真实交叉发生的事件重新切碎。流式刷新时替换整块正文，也会让桌面 WebView 中的滚动条拖动失去稳定目标。

Turn、Prompt Run 和 Follow-up Queue 仍然是必要的内部执行语义。问题只在于不应该把 Turn 强制变成默认视觉容器。

## 决策

Runtime Session Card 外层继续表示一个 Runtime Session，内部 transcript 改为连续 MessageList：

- `runtimeSessionMessageListProjection` 把内部 Turn Timeline 投影为有稳定 `id` 的消息行。
- `runtimeSessionMessageListView` 创建唯一 scroller，并按 `data-message-id` 对账更新消息行。
- 运行中按照真实到达顺序展示 Thinking、Tool、Permission、File Change、Runtime 和 Assistant 片段。
- 完成后以最终 Assistant Markdown 为主体，过程收敛为可展开的 `Worked for ...` 摘要。
- 原始 payload、完整日志和 usage 只进入 Debug。
- 旧历史保守投影，并显示旧版事件归属风险提示。

滚动状态机参考 AionUi 的桌面端 `useAutoScroll` 设计：

- 新用户输入显式定位到对应 user row。
- 流式内容仅在 following 状态下锚定底部。
- 用户滚轮、触控或拖动滚动条离开底部后暂停跟随。
- 用户回到底部或点击“滚动到最新”后恢复跟随。

## 参考

- AionUi `MessageList.tsx` 与 `useAutoScroll.ts`
- OpenCode `MessageTimeline`
- Codex transcript 与 command lifecycle

## 后果

- 用户默认看到连续工作记录，不再看到“第 N 轮”套娃卡片。
- Turn Timeline 继续作为内部有序事实存在，不因 UI 简化而删除。
- Session Card 局部更新必须保留 `.session-card-body`、`.runtime-message-list-scroller` 和 `.runtime-message-list-content` 的 DOM 身份。
- 新增 Card 行类型时，优先扩展 MessageList 投影与 View，不得恢复按事件类型拆分的固定面板。
