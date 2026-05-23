# 贡献指南

LunaAgentOS 正在建设一个以协议为核心的异构 Coding Agent 操作层。当前重点是稳定 Adapter Contract、Runtime Session Model、LunaAgentOS App，以及 Claude Code / Hermes first-party runtime entries。

## 当前产品边界

- `Claude Code` 是真实外部入口。
- `Hermes` 是真实外部入口。
- `Trae IDE` 是 IDE-first adapter path 的 Bridge 目标。
- LunaAgentOS App 是协议的具象化控制台和官方推荐使用方式。
- 新增 Agent 通过 adapter/plugin 接入 LunaAgentOS。
- 中间工作台的核心对象是 `Runtime Session Card`。
- 左侧是入口舰队和配置区。
- 右侧是活会话 / 归档会话列表和本地历史。

## 我们欢迎什么样的贡献

- Claude Code / Hermes runtime 稳定性。
- Hermes thought / tool / plan / usage 事件 UI。
- Runtime Session Card 视觉与可用性。
- 本地历史、恢复、删除、错误态验证。
- Trae IDE Bridge 设计与接入。
- Runtime surface / Adapter 协议收敛。
- Adapter manifest / capability model / unified JSON contract。
- 文档、截图、Demo 和发布材料。
- 测试与回归验证。

## 当前优先方向

### Runtime 稳定性

- Claude Code 会话路径稳定性。
- Hermes WSL / ACP 路径稳定性。
- runtime 退出、恢复、错误态、只读归档验证。

### Adapter Contract

- 明确 adapter manifest 应该描述什么。
- 明确不同 runtime surface 如何映射到统一 Runtime Session Event。
- 强化 Claude Code / Hermes first-party adapter 表达。
- 让新增 Agent 产品通过 Adapter Contract 接入。

### 会话卡片体验

中间会话卡片是当前产品主角。最需要：

- 更舒服的 Markdown / 代码 / 表格阅读。
- 更清楚的 thought / runtime / final response 层级。
- 更稳定的滚动、复制、全屏、只看最新等操作。
- 更接近 Hermes TUI 的“活会话”过程感。

### Bridge 方案

`Trae IDE` 代表 IDE-first Agent 产品的 Bridge 路径。

## 协作原则

### 中文优先

项目文档默认中文优先。GitHub 首页保留英文可扫描摘要，中文文档承载更完整解释。

### 真实入口优先

左侧展示的是外部入口对象。Claude 内部 subagent / delegation 属于 Claude 自身机制。

### Runtime Session 优先

中间卡片是 Runtime Session Surface。它要同时照顾：

- Claude Code 的长 Markdown / 代码输出。
- Hermes 的 thought / tool / plan / usage / state 过程事件。

### Protocol / Adapter 优先

LunaAgentOS 的核心是统一协议、Adapter / Plugin Contract 和 Runtime Session Model。LunaAgentOS App 是这套协议的具象化控制台和官方推荐使用方式。

### 保持轻核心

当前优先级之外：

- 一次性接入大量 Agent。
- 重 GUI 平台。
- 复杂商业功能。
- 超出 Runtime Session workspace 的复杂调用流。

### 对外部 Agent 保持尊重

LunaAgentOS 的目标是接入、观测、沉淀现有 Agent，并形成可扩展控制层。

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
- 截图 / Demo Mode / 发布视觉。

### 如果你偏产品 / 研究

适合参与：

- Agent 接入设计。
- Trae IDE Bridge 路线。
- 产品路线与架构分析。
- 文档与架构说明。

## 优先模块

### P0

- Runtime Session Card 打磨。
- Claude Code / Hermes runtime hardening。
- Hermes 过程事件 UI。
- 本地历史与恢复路径验证。
- README / 截图 / 快速开始。

### P1

- `Trae IDE` Bridge。
- 调用流设计。
- 协作工作台。
- 更清晰的控制平面边界。

## 当前边界

- 完全统一技术栈。
- 锁死所有架构细节。
- 支持所有 Agent。
- 插件市场或商业化平台。

当前更重要的是：

- 保持方向一致。
- 保持协议清晰。
- 保持边界诚实。
- 让 Claude Code + Hermes 的异构工作台稳定可信。

## 交流标准

如果你要参与，希望先确认 3 件事：

1. 你理解 LunaAgentOS 是“控制层”，不是另一个底层 Agent。
2. 你认可“协议优先、Adapter 优先、Runtime Session 优先”的推进方式。
3. 你认可当前目标是稳定异构 runtime workspace，并逐步扩展到 Adapter ecosystem 和 control plane。
