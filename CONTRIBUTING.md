# 贡献指南

LunaAgentOS 正在建设一个面向异构 Coding Agent 的轻量桌面控制台。当前最需要的是让 Claude Code + Hermes 的最小异构工作台足够稳定、清楚、可参与。

## 当前产品边界

- `Claude Code` 是真实外部入口。
- `Hermes` 是真实外部入口。
- `Trae IDE` 是 Bridge 目标，不伪装成当前已原生接入。
- 中间工作台的核心对象是 `Runtime Session Card`。
- 左侧是入口舰队和配置区，不是主工作区切换器。
- 右侧是活会话 / 归档会话列表和本地历史。

## 我们欢迎什么样的贡献

- Claude Code / Hermes runtime 稳定性。
- Hermes thought / tool / plan / usage 事件 UI。
- Runtime Session Card 视觉与可用性。
- 本地历史、恢复、删除、错误态验证。
- Trae IDE Bridge 研究。
- Runtime surface / Adapter 协议收敛。
- 文档、截图、Demo 和首发材料。
- 测试与回归验证。

## 当前最缺什么

### Runtime 稳定性

- Claude Code 会话路径继续打磨。
- Hermes WSL / ACP 路径继续打磨。
- runtime 退出、恢复、错误态、只读归档的验证。

### 会话卡片体验

中间会话卡片是当前产品主角。最需要：

- 更舒服的 Markdown / 代码 / 表格阅读。
- 更清楚的 thought / runtime / final response 层级。
- 更稳定的滚动、复制、全屏、只看最新等操作。
- 更接近 Hermes TUI 的“活会话”过程感。

### Bridge 方案探索

尤其是 `Trae IDE`。目标不是伪造接入，而是诚实探索桥接路径。

## 协作原则

### 中文优先

项目文档默认中文优先。GitHub 首页保留英文可扫描摘要，中文文档承载更完整解释。

### 真实入口优先

左侧展示的是外部入口对象，不是内部假角色。不要把 Claude 内部 subagent / delegation 提升成 LunaAgentOS 左侧独立 agent。

### Runtime Session 优先

中间卡片不是普通聊天气泡容器，而是 Runtime Session Surface。它要同时照顾：

- Claude Code 的长 Markdown / 代码输出。
- Hermes 的 thought / tool / plan / usage / state 过程事件。

### 不过早做大全

当前不鼓励：

- 一次性接很多 Agent。
- 为了“完整”而做过重 GUI 或复杂平台。
- 先做复杂商业功能。
- 在当前工作台基础还不稳时提前做复杂调用流。

### 对外部 Agent 保持尊重

LunaAgentOS 的目标不是重写现有 Agent，而是接入、观测、沉淀，并逐步形成控制层。

## 参与建议

### 如果你偏协议 / 后端

适合参与：

- Runtime 管理。
- ACP 事件去噪与恢复策略。
- Runtime surface 抽象。
- 统一消息流。
- 本地历史与会话恢复。

### 如果你偏桌面端 / UI

适合参与：

- 控制台布局。
- Runtime Session Card。
- 思考流 / 运行流 / 最终响应层级。
- Markdown、代码块、表格、全屏阅读。
- 截图 / Demo Mode / 首发视觉。

### 如果你偏产品 / 研究

适合参与：

- Agent 接入调研。
- Trae IDE Bridge 路线。
- 竞品与路线分析。
- 文档与架构说明。

## 当前优先模块

### P0

- Runtime Session Card 打磨。
- Claude Code / Hermes runtime hardening。
- Hermes 过程事件 UI。
- 本地历史与恢复路径验证。
- GitHub 首发 README / 截图 / 快速开始。

### P1

- `Trae IDE` Bridge。
- 调用流设计。
- 更完整的协作工作台。
- 更清晰的控制平面边界。

## 当前不要求

- 一开始就完全统一技术栈。
- 一开始就锁死所有架构细节。
- 一开始就支持所有 Agent。
- 一开始就做插件市场或商业化平台。

当前更重要的是：

- 保持方向一致。
- 保持协议清晰。
- 保持边界诚实。
- 让 Claude + Hermes 的最小异构工作台足够可信。

## 交流标准

如果你要参与，希望先确认 3 件事：

1. 你理解 LunaAgentOS 是“控制层”，不是另一个底层 Agent。
2. 你认可“真实入口优先、会话卡片优先”的推进方式。
3. 你接受当前目标是最小异构闭环，而不是一开始追求大全。
