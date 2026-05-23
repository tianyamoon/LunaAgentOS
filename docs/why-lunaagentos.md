# 为什么做 LunaAgentOS

## 不是因为没有 Agent

今天的问题不是“找不到 Agent”。

真正的问题是：

- Agent 越来越多
- 协议越来越碎
- 工具越来越强
- 但控制层几乎没有统一标准

结果就是：

- 每个 Agent 都能干活
- 但多个 Agent 很难被统一编排
- 人类也很难真正掌控全局

## LunaAgentOS 想解决的不是单点能力

LunaAgentOS 想解决的是更上层的问题：

- 如何让多个现成 Agent 被统一接入
- 如何让它们拥有统一状态流
- 如何让工具调用可见
- 如何让任务可以被分发、审批、归档

一句话：

LunaAgentOS 不做“更强的某一个 Agent”，而做“多个 Agent 之上的控制层”。

## 为什么这件事值得做

### 1. 市场已经证明“统一接入”有需求

已经有产品在做多 Agent 或多 Provider 的统一入口，这说明方向不是伪需求。

### 2. 但“接入”本身不是终局

真正更有价值的是：

- 控制台
- 控制平面
- 协作与审批
- 历史与观测
- 任务编排

### 3. 这比单个模型能力更耐久

模型会变，Provider 会变，CLI 会变。  
但“如何统一掌控多个 Agent”这个问题，会长期存在。

## 为什么第一版不是为了完成功能

第一版真正的意义是：

- 吸引参与者
- 形成共识
- 建立骨架
- 证明方向

如果第一版不能让别人愿意加入，那它就还不是一个真正的项目起点。

## 为什么选“强大 / 通用 / 免费”三家样板

因为我们不是在选三个最像的技术目标，而是在选三个最能代表产品价值的位置：

- `Claude Code`：强大
- `Hermes`：通用
- `Trae IDE`：免费

这三者共同构成 LunaAgentOS 的初始叙事：

- 能接强 Agent
- 能接现实可用 Agent
- 能覆盖免费入口

## 为什么协议很重要

如果没有统一协议，LunaAgentOS 就只是一个项目名。

真正让这个项目成立的，是这些核心契约：

- `manifest`
- 生命周期状态机
- 统一消息格式

这套协议决定了未来是否能形成：

- 插件生态
- 可扩展 Adapter
- 统一 UI 与控制逻辑

## 为什么 App 不是灵魂

桌面壳很重要，因为它让协议和 runtime session 变得可见、可验证、可使用。

但 LunaAgentOS 的灵魂不是某一个 App，而是：

- 统一 JSON Contract
- Runtime Adapter / Plugin Contract
- Runtime Session Model
- tools / models / skills / MCP 等共用能力层

真正的目标是：未来出现新的 Agent 产品时，不需要修改 LunaAgentOS core 或 app，而是通过 adapter manifest 和 adapter implementation 接入。

Claude Code 和 Hermes 是 first-party adapters，是样板和验证路径，不是 LunaAgentOS 的产品定义本身。

## 结论

LunaAgentOS 值得做，不是因为世界上缺一个 Agent，而是因为世界上缺一个真正可扩展的 Agent 控制层。
