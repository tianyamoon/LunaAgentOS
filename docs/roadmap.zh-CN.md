# 路线图

[English](./roadmap.md)

LunaAgentOS 的长期方向是 AI 时代的个人 Agent 操作系统。0.2 Preview 已在真实 AI Agent 会话的中立桌面工作台上沉淀下第一块奠基石；后续路线图沿着这个方向一段一段推进 Agent 可用性管理、Runtime Session 行为、adapter 边界与可定向的 session handoff。

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

## 下一步：0.3 Agent 管理和健康诊断

0.3 在 0.2 的工作台底盘之上，先把两件基础能力做扎实，为后续的跨 Agent 协作铺路：

- Agent 管理：身份、profile、模型、能力、安全边界和最佳实践。
- 真实健康诊断：安装、调用、登录、配置、WSL/Bridge、模型或密钥、版本、失败原因和修复建议。
- Runtime Session Card 继续只负责会话状态、执行过程、响应、历史和恢复。
- 继续把 adapter manifest fields 和 capability metadata 做实，让 Agent 管理不是纯 UI 文案。
- 继续保持 App 作为协议的具体控制台和当前官方推荐使用路径。

更具体的 0.3 范围见 [0.3 需求定义](./requirements-0.3.zh-CN.md)。

## 然后：Adapter contract seam 和 call flow

在 Agent 管理和 Runtime Session 更可靠之后，再单独设计 adapter call flow：

- 把 Claude Code 和 Hermes 作为 registry adapters；需要时通过 built-in extensions 扩展。
- 让 Trae IDE 保持在 IDE-first bridge 路线上。
- 让新 Agent 产品通过 Adapter Contract 进入。
- Task、Task Board、handoff 和跨 Agent call flow 均属于后续阶段。

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
