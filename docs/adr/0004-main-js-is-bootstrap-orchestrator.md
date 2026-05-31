# desktop Shell 的 main.js 只承担启动编排

`apps/desktop-shell/src/main.js` 是 desktop Shell 的 bootstrap/orchestrator，不是承载所有规则的全能脚本。状态 mutation、runtime 命令参数装配和可复用视图行为应进入有明确 Interface 的深 Module；`main.js` 负责创建 Module、注入 Adapter、绑定顶层事件并编排跨 Module 流程。

## Consequences

- 不再向 `main.js` 添加大段独立 Implementation。
- 新逻辑优先寻找现有 Seam，或在确有 Leverage 时新增小 Interface、深 Implementation 的 Module。
- 跨 Module 的产品流程仍可留在 `main.js`，直到其自身形成稳定概念和可测试 Interface。
- 当前已抽取 `workspaceViewStore`、`workspaceSessionController`、`sessionRuntimeState`、`sessionTurnState` 和 `acpRuntimeClient`。
- History 访问统一进入 `historyRepository`；session 恢复、生命周期、执行和发送启动分别进入独立 Controller。
- Composer、Agent Fleet、连接管理和 Runtime Session Card 已进入独立 View 或 Controller Module。
- `main.js` 当前仍保留顶层依赖注入、启动顺序和尚未稳定成型的跨 Module 编排。后续收缩必须继续遵循“先建立 Interface，再迁移 Implementation”的节奏。
