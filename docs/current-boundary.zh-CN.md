# 当前产品边界

[English](./current-boundary.md)

LunaAgentOS 的目标是 AI 时代的个人 Agent 操作系统：让用户像装应用一样装 Agent、像调度进程一样调度任务、像管本地资料一样掌控 Agent 记忆。0.2 Preview 沉淀了通往这个目标的若干先决能力——一个能承载真实 AI Agent 会话、可信且可归档的中立桌面工作台。

这个页面给出当前发布边界：现在已经做实了什么、下一段路怎么走、哪些常见误解需要先讲清。

## 现在是什么

- **中立桌面工作台**：app 给真实 AI Agent 会话提供共享的本地界面，但不宣称拥有这些 Agent 本身
- **Windows 优先**：当前产品路径是 Windows 上的 Tauri 桌面应用
- **真实 session 工作台**：中心对象是 Runtime Session Card，而不是通用气泡聊天列表
- **本地优先历史界面**：session turns、归档会话、恢复动作和只读历史状态保存在本地
- **由 protocol 和 adapters 支撑的工作台体验**：protocol、adapter 边界和 Runtime Session Model 是支撑结构，不是产品界面本身

## 现在已经可用什么

- Claude Code 可以作为真实 runtime entry 使用
- Hermes 可以通过 Windows / WSL ACP runtime instance 和 profile 使用
- Trae IDE 被表达为 IDE-first bridge path
- 左侧展示 Agent Fleet 和当前发送目标
- 中间工作台展示活跃的 Runtime Session Cards
- 每张卡片同时承载 output、thought、runtime stream 和 final response
- 右侧区分 live sessions 和 archived sessions
- 本地 JSON history 支持 session turn 保存、恢复和只读归档
- 当某个 runtime 未安装时，对应入口仍然显示在 Agent Fleet 中，并显示明确的配置状态。这是可解释状态，不是崩溃或静默失败

## 距离完整形态还有多远

0.2 Preview 是奠基阶段，下一段路在这些方向上顺势展开：

- **多 Agent orchestration**：当前以“当前发送目标”承担单线工作流；跨 Agent 调度与协作是下一阶段的核心命题
- **跨 Agent 上下文桥接与共享记忆**：先做 session 内可恢复，再做可定向的 session handoff，最后再设计跨 Agent 记忆总线
- **Remote 与 team 入口**：本地稳态之后的扩张方向
- **Agent marketplace 与生态层**：adapter manifest 已为它留好接入面，产品形态留待后续版本

也借此划清几条边界，避免把 LunaAgentOS 错认成它不是的东西：

- 不把外部 Agent 收编为单一内置 runtime——每个 Agent 保留自己的内部机制
- adapter 是翻译层，不是同化层

## 建模规则

### 外部入口

左侧入口舰队表示的是外部 entry 对象：

- Claude Code
- Hermes
- Trae IDE bridge path

Claude 内部的 subagent 或 delegation worker 仍然属于 Claude 自身机制。

### Adapter 边界

Claude Code 和 Hermes 是用来验证 contract 的真实 runtime entries。

adapter 规则是：

```text
new agent product -> adapter manifest + adapter implementation -> LunaAgentOS unified JSON contract
```

新增 Agent 产品沿着 adapter/plugin 安装路径和归一化 Runtime Session events 进入系统。adapter contract 是这条路的接入面，仍在持续打磨。

### 当前发送目标

当前发送目标回答的是：“下一条用户输入默认发到哪里？”

活跃 session 工作台仍然是多会话工作的中心。

### Runtime Session Cards

一张 session card 是这些内容的共享界面：

- 用户任务
- runtime 输出
- thought stream
- runtime / tool / plan / usage stream
- final response
- 本地历史与恢复状态

## 下一层能力

下一层走在 0.2 的工作台底盘之上，重点把这些做扎实：

- 加强 Claude Code 和 Hermes runtime entry 的可靠性
- 让本地历史和恢复行为更可信
- 讲清 adapter 安装与 capability 边界
- 加强 Trae IDE bridge path
- 设计可定向的 session handoff，让用户在能力真正实现后，可以有意地把选中的上下文移动到另一个 entry 或 session
