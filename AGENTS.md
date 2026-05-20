# LunaAgentOS Agent Guide

## 项目一句话

LunaAgentOS 不是另一个底层 Agent，而是**异构 Agent 之上的统一控制层**。  
最终目标是长成**异构 Agent 的操作系统**。

## 当前最重要的产品边界

### Stage 体系

当前文档里的 `Stage 1 / Stage 2 / Stage 3 / Stage 4` 是：

- **内部推进阶段**
- **不是对外发布版本号**

当前统一口径：

- `Stage 1`：最小异构雏形
- `Stage 2`：调用流
- `Stage 3`：更完整的协作工作台
- `Stage 4`：控制平面

### Stage 1 必须成立的东西

`Stage 1` 不是“Claude 桌面壳”，而是**最小异构控制台雏形**。

必须同时成立：

- `Claude Code` 真实可用
- `Hermes` 真实可用

如果只有 Claude，不算最小异构控制台成立。

### 当前主链路

1. 启动桌面控制台
2. 左侧展示入口舰队
3. 右侧展示历史任务
4. 用户设定当前发送目标
5. 用户输入任务并发送
6. 中间工作台生成会话卡片
7. 卡片承载输出流 / 思考流 / 最终响应
8. 会话结果沉淀到历史 JSON

## 关键术语

### 入口

左侧展示的是**外部入口对象**，不是内部假角色。

当前典型入口：

- `Claude Code`
- `Hermes`
- `Trae IDE`

### 会话

中间工作台里的核心对象是 **session / 会话卡片**。  
不是单详情页，也不是单聊天框。

### 当前发送目标

系统允许有多个入口、多个会话。  
但输入框每次默认发给谁，必须有明确答案。

所以当前有一个：

- `当前发送目标`

注意：

- 这不等于“系统里只有一个 Agent”
- 它只是输入默认路由的目标

### Claude 的边界

在 LunaAgentOS `Stage 1` 中：

- `Claude Code` 按“单入口 + 多会话”处理
- Claude 内部的 `subagent / delegation` 视为它自己的内部机制
- **不要**把 Claude 内部 worker 提升成 OS 左侧独立 agent

### Hermes 的边界

Hermes 对 LunaAgentOS 很重要，因为它不只是第二个入口，还承载：

- WSL / ACP 接入验证
- profile-based entry 验证
- 更贴近 TUI 的过程可见性验证

## UI / 交互当前共识

### 左侧

左侧是：

- 入口舰队展示区
- 配置区

不是：

- 主工作区切换器

默认规则：

- 点击左侧入口，不应该粗暴刷新整个主区
- 左侧负责展示、选择当前发送目标、预留管理入口

### 中间

中间是：

- 会话工作台

要求：

- 显示所有已激活会话
- 每张卡片独立滚动
- 每张卡片支持全屏
- 会话卡片核心内容优先级：
  - 输出流
  - 思考流
  - 最终响应

### 右侧

右侧当前优先做：

- 历史任务 / 历史会话
- 按日期读取本地 JSON

## Hermes 特别说明

Hermes 当前的正确方向不是单纯“更快”，而是：

- **让慢变得可见**
- 尽量做出 Hermes 自己 TUI 那种“活会话”的感觉

关键参考：

- `docs/hermes-tui-direction.md`

当前已经确认：

- ACP 后端能够拿到 `session/update`
- 包括 thought / message / tool / plan / usage 等过程事件

所以后续不要把 Hermes 只做成“整轮结束后吐一个结果”。  
要优先追求：

- 过程可见
- 会话活着
- 工作过程像终端

## 工程当前重点

### 前端

关键文件：

- `desktop-shell/src/index.html`
- `desktop-shell/src/main.js`
- `desktop-shell/src/styles.css`

### Tauri / Rust

关键文件：

- `desktop-shell/src-tauri/src/lib.rs`
- `desktop-shell/src-tauri/src/acp_runtime.rs`

### 重要文档

优先读这些：

- `README_CN.md`
- `docs/mvp-v1-interaction-model.md`
- `docs/version-roadmap.md`
- `docs/handoff-next-agent.md`
- `docs/prompt-v1-alignment.md`
- `docs/hermes-tui-direction.md`

## 代码评审方法

默认按**代码审查模式**工作：

1. 优先找 bug / 风险 / 行为回归
2. 再谈结构和美化
3. Findings 优先于总结

评审输出顺序建议：

1. Findings
2. Open questions / assumptions
3. Change summary

如果没有发现问题，也要明确说：

- 没发现明确缺陷
- 但还剩哪些测试空白或风险点

## 修改代码时的原则

- 不要轻易扩需求
- 优先对齐已写入文档的产品边界
- UI 可以优化，但不要偏离当前工作台模型
- 不要把“输入默认目标”重新做回“系统只有一个主 Agent”
- 不要把 Claude 内部 subagent 误建模成左侧多个外部 agent

## Wiki SOP（必须遵守）

Wiki 根目录：

- `F:\wiki\ailearing`

开始前必须先读：

- `F:\wiki\ailearing\SCHEMA.md`
- `F:\wiki\ailearing\index.md`

如果改了 `concepts/` 下内容，必须同时：

1. 查重
2. 更新 `index.md`
3. 追加 `log.md`
4. 在 `F:\wiki\ailearing` 本地 git commit

绝对红线：

- 禁止修改 `F:\wiki\trade-system`
- 禁止修改 `F:\wiki\social-media`
- 禁止跳过 `index.md`
- 禁止跳过 `log.md`
- 禁止不提交就结束 wiki 任务

## Git 规则

- 允许本地提交
- **不要主动 push**
- 当前仓库可能长期 ahead 远端很多提交，这是正常的

## 面向 Codex 的工作风格

任何新进来的 agent，优先做这三件事：

1. 先读文档，不要先猜
2. 先确认当前 Stage 边界，不要先扩设计
3. 先保护工作台模型，再谈额外能力

一句话总结：

> 先让 LunaAgentOS 稳稳成为 Claude + Hermes 的最小异构工作台，再往调用流、协作流和控制平面长。
