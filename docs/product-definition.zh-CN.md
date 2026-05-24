# 产品定义

LunaAgentOS 是一个以协议为核心的异构 Coding Agent 控制层。

当前的 LunaAgentOS App 是这套控制层的产品化界面：选择目标，把任务送进真实 runtime session，观察过程，并把本地历史留在一个地方。

## 产品形态

LunaAgentOS 由四个互相支撑的部分组成：

- **统一 JSON Contract**：为 adapter 身份、runtime session、runtime event、capability 和 history 提供稳定的公开结构
- **Runtime Adapter / Plugin Contract**：外部 Agent 产品接入 LunaAgentOS 的边界
- **Runtime Session Model**：让不同 app 可以一致渲染 session、turn、lifecycle 和 history
- **LunaAgentOS App**：把契约真正变成可用产品体验的桌面工作台

## 为什么 App 很重要

App 不是协议旁边的附属项目，它就是协议的参考产品体验。

今天它提供：

- 原生桌面窗口
- Agent Fleet 和 runtime 配置
- Runtime Session Cards
- 活会话和归档会话
- 本地历史、恢复动作和只读历史状态

协议定义契约，App 证明契约是可用的。

## Adapter 路径

新 Agent 产品应该沿着 adapter 边界进入 LunaAgentOS：

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> LunaAgentOS unified JSON contract
  -> adapter host
  -> Runtime Session Model
  -> app rendering
```

这样可以在保持产品体验一致的同时，保留每个 runtime 自己的强项。

## Runtime surfaces

不同产品会暴露不同的 runtime surface。LunaAgentOS 把它们当成 adapter 侧的问题，而不是产品边界本身。

当前主路径：

- **ACP / protocol**：结构化 runtime session 与 update

计划中或可扩展的路径：

- **PTY / terminal**：兼容原生 CLI / TUI
- **SDK streaming**：官方可编程 runtime
- **Gateway / HTTP / WebSocket**：远程或后台 agent
- **IDE Bridge**：IDE-first 产品

## 首批 registry adapters

registry adapters 的作用，是验证并打磨 contract：

- **Claude Code**：验证高价值 coding workflow 和长文本输出处理
- **Hermes**：验证 profile 身份、Windows / WSL 路由和丰富的 runtime event 可见性
- **Trae IDE**：代表 IDE-first bridge 路线

它们不是假的演示入口，而是通过同一模型进入系统的真实外部产品。

## 设计约束

当前的产品定义遵循几条约束：

- 控制层保持轻
- 保留 runtime 原生强项，不把一切强行压成同一种聊天界面
- 把过程可见性当成一等公民
- 让本地历史可持久、可恢复
- 在追求 marketplace 或平台广度之前，先把 adapter contract 做扎实

## 下一阶段的边界

当前仓库已经有可运行的 app 和第一批真实接入。下一阶段更重要的，不是再换一个说法，而是把 adapter 边界讲清楚，把 runtime workspace 做扎实，把协议变得更容易扩展。
