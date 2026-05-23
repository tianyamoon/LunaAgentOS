# 为什么做 LunaAgentOS

## Agent 需要统一控制层

Coding Agent 正在进入多个形态：

- CLI Agent
- TUI Agent
- IDE Agent
- Gateway / 服务型 Agent
- SDK / 可编程 Agent

这些 Agent 的能力越来越强，但入口、协议、运行状态、历史和权限模型仍然分散。LunaAgentOS 解决的是这些 Agent 之上的统一控制问题。

## LunaAgentOS 的定位

LunaAgentOS 是一个以协议为核心的异构 Coding Agent 操作层。

它提供：

- **统一入口**：把不同 Agent 产品呈现为可选择、可配置、可观察的 runtime entries。
- **统一协议**：用 Adapter Contract 描述 runtime surface、capability、target/profile 和 session behavior。
- **统一会话模型**：用 Runtime Session Model 承载 output、thought、runtime events、final response、history 和 restore state。
- **统一工作台**：用 LunaAgentOS App 把协议变成可运行、可观察、可恢复的产品体验。

## 当前已经具备的基础

LunaAgentOS 当前包含：

- 可运行的 Tauri 桌面 App。
- Claude Code first-party adapter entry。
- Hermes Windows / WSL ACP runtime instances and profiles。
- Trae IDE bridge entry。
- Agent Fleet、当前发送目标和 provider/runtime/profile 状态。
- Runtime Session Cards。
- 活会话 / 归档会话列表。
- 本地 JSON history、恢复和错误态。
- 协议、adapter、core、app 的清晰仓库边界。

## 为什么协议是核心

统一协议让 LunaAgentOS 可以把不同产品映射到同一个操作模型：

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> normalized Runtime Session events
  -> App workspace
```

这个模型让 LunaAgentOS 可以持续接入新的 Agent 产品，同时保持 App 体验一致。

## First-party adapters 的作用

Claude Code 和 Hermes 是当前 first-party adapters：

- Claude Code 验证长文本、Markdown、代码输出和 resumable coding sessions。
- Hermes 验证 profile identity、WSL routing、ACP events、thought/tool/plan/usage stream 和过程可见体验。

Trae IDE 代表 IDE-first bridge path，用于把 IDE-native Agent 产品纳入同一个 Adapter Contract。

## 未来方向

LunaAgentOS 的未来方向是成为异构 Agent 的控制平面：

- 更稳定的 Adapter Host。
- 更清晰的 Capability Model。
- 更强的 Runtime Session replay、restore 和 observation。
- 可选择内容并发送到其他 entry 或 session 的 call flow。
- 多 Agent 协作工作台。
- tools、models、skills、MCP resources、permissions 和 routing 的统一能力层。

## 结论

LunaAgentOS 值得做，因为 Agent 产品会持续增加，用户需要一个稳定、开放、可扩展的控制层来统一入口、过程、历史和协作。
