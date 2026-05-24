# 当前产品边界

[English](./current-boundary.md)

LunaAgentOS 现在是一个以协议为核心、已经有可运行 App 的异构 coding-agent runtime 控制层。

## LunaAgentOS 现在是什么

- **位于现有 Agent 之上的控制层**：连接外部 runtime，同时保留它们的原生强项
- **Runtime Adapter / Plugin contract**：新 Agent 产品通过 adapter 和归一化 runtime events 进入系统
- **Runtime Session workspace**：中心对象是 session card，而不是传统气泡聊天列表
- **中立控制台**：Claude Code、Hermes、IDE Bridge 都被建模为外部入口
- **本地优先 App**：App 是协议的具体控制台，也是当前官方推荐的使用路径

## 现在已经可用什么

- Claude Code 可以作为真实 runtime entry 使用
- Hermes 可以通过 Windows / WSL ACP runtime instance 和 profile 使用
- 左侧展示 Agent Fleet 和当前发送目标
- 中间工作台展示活跃的 Runtime Session Cards
- 每张卡片同时承载 output、thought、runtime stream 和 final response
- 右侧区分 live sessions 和 archived sessions
- 本地 JSON history 支持 session turn 保存、恢复和只读归档
- demo mode 可以展示理想中的 Claude + Hermes workspace，而不写入真实历史
- 当前架构已经由 protocol、adapters 和 Runtime Session Model 约束

## 当前范围

- LunaAgentOS 通过 adapters 控制和观测外部 runtimes
- LunaAgentOS 把 Claude Code、Hermes、Trae IDE 都保留为外部产品入口
- LunaAgentOS 围绕 Runtime Session Cards 组织工作
- 在考虑 marketplace 或商业平台功能之前，先增强 adapter capability、runtime routing 和 collaboration flow

## 建模规则

### 外部入口

左侧入口舰队表示的是外部 entry 对象：

- Claude Code
- Hermes
- Trae IDE bridge entry

Claude 内部的 subagent 或 delegation worker 仍然属于 Claude 自身机制。

### Adapter 边界

Claude Code 和 Hermes 是用来验证 contract 的 registry adapters。

adapter 规则是：

```text
new agent product -> adapter manifest + adapter implementation -> LunaAgentOS unified JSON contract
```

新增 Agent 产品应该沿着 adapter/plugin 安装路径和归一化 Runtime Session events 进入系统。

### 当前发送目标

当前发送目标回答的是：“下一条用户输入默认发到哪里？”

而活跃 session 工作台仍然是多会话协作的中心。

### Runtime Session Cards

一张 session card 是这些内容的共享界面：

- 用户任务
- runtime 输出
- thought stream
- runtime / tool / plan / usage stream
- final response
- 本地历史与恢复状态

## 下一步方向

下一层产品能力是可定向的协作：

- 把选中的 session 内容发送给另一个 entry
- 把选中的内容发送给另一个已有 session
- 让 source session 与 target session 的关系可见
- 在 agent 协作时继续保持人类控制清晰可见
