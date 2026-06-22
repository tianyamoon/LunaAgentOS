# 产品定义

[English](./product-definition.md)

LunaAgentOS 的长期方向是 AI 时代的个人 Agent 操作系统：让用户像装应用一样装 Agent、像调度进程一样调度任务、像管本地资料一样掌控 Agent 记忆。

LunaAgentOS 从真实 AI Agent 会话的中立桌面工作台开始。0.3 当前阶段先收紧 Agent 管理、证据化健康诊断和 Runtime Session 语义；Task、Handoff、编排与协作仍是独立的后续产品阶段。

产品从工作台体验开始：选择真实 runtime 入口，把 prompt 送进真实 session，观察过程，并把本地历史留在一个地方。Protocol、adapters 和 Runtime Session Model 是支撑这套体验的结构，而不是 LunaAgentOS 首先要求用户理解的卖点。

## 0.3 当前产品形态

LunaAgentOS 0.3 围绕以下部分展开：

- **LunaAgentOS App**：Windows 优先的 Tauri 桌面工作台
- **Runtime Session Cards**：统一承载输出、thought、runtime events、final response 和恢复状态
- **本地历史**：JSON session history、恢复动作和只读归档状态
- **真实 runtime 入口**：Claude Code 和 Hermes 作为真实外部 runtime
- **Bridge 路线**：Trae IDE 作为 IDE-first bridge 方向
- **Agent 管理与诊断**：展示身份、模型管理方式、能力边界和带证据的健康状态

## 支撑架构

这个桌面工作台由一组轻量契约支撑：

- **Runtime Session Model**：让 app 可以一致渲染 session、turn、lifecycle 和 history
- **Runtime Adapter / Plugin Contract**：外部 Agent 产品接入 LunaAgentOS 的边界
- **统一 JSON Contract**：为 adapter 身份、runtime session、runtime event、capability 和 history 提供稳定结构

协议定义契约，App 证明契约可以形成可用的产品体验。

## 今天已经可用什么

今天 app 提供：

- Windows 优先的原生桌面窗口
- Agent Fleet 和 runtime 配置
- Claude Code 作为真实 runtime 入口
- Hermes 通过 Windows / WSL ACP runtime instance 与 profile 使用
- 面向活会话的 Runtime Session Cards
- 归档会话与本地历史
- 恢复动作与只读历史状态
- 通过 Claude Code 和 Hermes session 验证真实 runtime 路径

## Adapter 路径

预期接入路径仍然是 adapter-based：

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> LunaAgentOS unified JSON contract
  -> adapter host
  -> Runtime Session Model
  -> app rendering
```

这样可以在保持工作台中立的同时，保留每个 runtime 自己的强项。

## 当前外部入口

- **Claude Code**：验证真实 session 输出、长文本响应和 coding workflows
- **Hermes**：验证 profile 身份、Windows / WSL 路由、ACP sessions 和更丰富的 runtime event 可见性
- **Trae IDE**：代表 IDE-first bridge 路线

它们是真实外部产品进入工作台。LunaAgentOS 0.2 Preview 把工作台做成它们共同的承载面，每个 Agent 自己的能力仍由它们提供。

## 设计约束

当前的产品定义遵循几条约束：

- 先讲中立桌面工作台，再解释支撑协议
- 保留 runtime 原生强项，不把一切强行压成同一种聊天界面
- 把过程可见性当成一等公民
- 让本地历史可持久、可恢复
- 把 0.3 定位为 Agent 管理、证据化健康诊断和 Runtime Session 语义收紧阶段，不越阶表达
- 在追求 marketplace 或商业平台广度之前，先把 adapter contract 做扎实

## 0.3 边界

当前仓库已经有可运行的 app 和第一批真实接入。0.3 只加强 runtime 入口稳定性、Agent 管理、模型控制表达、健康诊断证据链和 Runtime Session 语义。Task、Task Board、Handoff、自动分派和多 Agent 编排不属于本阶段。
