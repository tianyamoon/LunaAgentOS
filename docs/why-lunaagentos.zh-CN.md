# 为什么做 LunaAgentOS

## 问题是什么

Coding Agent 正在演化成多种产品形态：

- CLI Agent
- TUI Agent
- IDE Agent
- gateway / 服务型 Agent
- SDK-first 的可编程 Agent

它们的能力越来越强，但人类操作它们的工作空间仍然是割裂的。入口、可见性、历史和路由都分散在不同产品里。

## 这个项目的回答

LunaAgentOS 用一个位于 runtime 之上的控制层来回答这种割裂。

它想提供的是：

- 一个统一的异构 Agent 入口面
- 一个共享的 adapter contract，用来描述 runtime surface、target 和 capability
- 一个能承载 output、thought、runtime events、final response、history 和 restore state 的 Runtime Session model
- 一个把这些想法真正做成工作台的桌面 app

## 为什么协议重要

如果没有稳定协议，每接入一个新产品都会变成一次独立的 UI 特例。

协议让 LunaAgentOS 可以把不同产品映射到同一个操作模型里：

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> normalized Runtime Session events
  -> app workspace
```

这也是“一次性集成”和“可持续扩展系统”之间的区别。

## 为什么 first-party adapters 很重要

Claude Code 和 Hermes 是这套模型的第一批现实检验。

- Claude Code 用来验证长文本 coding 输出、markdown-heavy session 和可恢复工作流
- Hermes 用来验证 WSL 路由、ACP updates、profile identity 和高可见性的过程事件
- Trae IDE 让 IDE-first bridge 路线不只是口头设想

它们共同逼着 contract 去面对真实 runtime 行为，而不是理想化例子。

## 这个项目想保留什么

LunaAgentOS 不是要抹平所有产品差异。

它想同时保留三件事：

- 每个 runtime 自己的原生强项
- 给人类操作者一个连贯的工作空间
- 为后续接入更多 Agent 产品留下稳定边界

## 近期方向

近期目标不是“先接得越多越好”，而是“先做得可信”：

- 保持当前 app 稳定
- 改进 Runtime Session workspace
- 让 adapter boundary 更明确
- 加强本地历史和恢复能力
- 在调用流落地时，让 agent-to-agent 路由关系可见

如果这个基础足够扎实，LunaAgentOS 才有机会成长为更广义的 control plane，而不是另一个薄薄的 chat wrapper。
