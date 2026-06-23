# Workspace Focus 属于视图状态

Workspace Focus 是用户在工作区突出查看某张 Runtime Session Card 的展示模式，不是 Runtime Session 的业务状态。Focus 状态由独立 workspace view store 管理；切换当前 session 时，如果工作区仍处于 focused 模式，主视图应同步切换到新 session。旧数据中的 `session.fullscreen` 只允许作为一次性兼容迁移来源，新逻辑不再写入该字段。

## Consequences

- Runtime Session 不持久化 fullscreen 展示字段。
- 底部缩略图、右侧会话列表和卡片 focus 按钮统一经过 workspace focus Interface。
- Focus 切换不能改变 lifecycle、history 或 runtime binding。
