# 路线图

[English](./roadmap.md)

LunaAgentOS 正在从可运行的 protocol console，成长为以协议为核心的 adapter layer、Runtime Session Model、协作工作台和更广义的 control plane。

## 当前：产品定义和 Runtime Session workspace

当前重点是把产品定义讲清楚，同时让 Claude Code + Hermes 在 LunaAgentOS App 内可信可用：

- Protocol / Adapter Contract / Runtime Session Model 作为架构指导。
- 真实外部 runtime entries。
- 当前发送目标。
- 多会话 Runtime Session Cards。
- Output、thought、runtime 和 final response surfaces。
- 本地 JSON history。
- Live / archived session lifecycle。
- Runtime detection 和清晰配置状态。

## 下一步：Adapter contract seam

下一层架构工作是把 adapter 边界做实：

- 定义 adapter manifest fields 和 capability metadata。
- 把 Claude Code 和 Hermes 作为 registry adapters；需要时通过 built-in extensions 扩展。
- 让 Trae IDE 保持在 IDE-first bridge 路线上。
- 让新 Agent 产品通过 Adapter Contract 进入。
- 保持 App 作为协议的具体控制台和当前官方推荐使用路径。

## 然后：Sessions 和 entries 之间的 call flow

下一层能力是可见 routing：

- 从 session card 中选择内容。
- 把它发送给另一个 runtime entry 或另一个已有 session。
- 保留 source、target 和 task context。
- 让调用关系在 workspace 中可见。

## 后续：协作工作台

在 call flow 存在之后，LunaAgentOS 可以成长出更强的协作模型：

- 多个 entries 处理相关任务。
- 清晰的 target roles 和 capabilities。
- 人类可读的 routing decisions。
- Agent-initiated suggestions 仍然保持人类控制明确。

## 长期：Control plane

长期方向是面向异构 agents 的 operating layer：

- Provider 和 runtime management。
- Session replay、restore 和 observation。
- Human approval flow。
- Task distribution。
- Runtime health 和 error-state handling。
- 面向更多 entries 的稳定 extension model。

## 产品原则

路线图保持渐进：先让产品定义和 runtime workspace 可信，然后把 adapter contract 做实，再加入 call flow、collaboration 和更广义的 control-plane capabilities。
