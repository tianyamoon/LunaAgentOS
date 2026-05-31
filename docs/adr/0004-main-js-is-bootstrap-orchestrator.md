# desktop Shell 的 main.js 只承担启动编排

`apps/desktop-shell/src/main.js` 是 desktop Shell 的 bootstrap/orchestrator，不是承载所有规则的全能脚本。状态 mutation、runtime 命令参数装配和可复用视图行为应进入有明确 Interface 的深 Module；`main.js` 负责创建 Module、注入 Adapter、绑定顶层事件并编排跨 Module 流程。

## Consequences

- 不再向 `main.js` 添加大段独立 Implementation。
- 新逻辑优先寻找现有 Seam，或在确有 Leverage 时新增小 Interface、深 Implementation 的 Module。
- 跨 Module 的产品流程仍可留在 `main.js`，直到其自身形成稳定概念和可测试 Interface。
- 当前已抽取 `workspaceViewStore`、`workspaceSessionController`、`sessionRuntimeState`、`sessionTurnState` 和 `acpRuntimeClient`。
