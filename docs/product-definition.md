# 产品定义

LunaAgentOS 是一个以协议为核心的异构 Coding Agent 操作层。LunaAgentOS App 是协议的具象化控制台，也是当前官方推荐使用方式。

## 核心身份

LunaAgentOS 要解决的是不同 Agent 产品之间缺少统一控制层的问题。

产品核心是：

- **统一 JSON Contract**：稳定描述 adapter manifest、runtime session、event、tools、models、skills、MCP resources、permissions、routing metadata 和 history。
- **Runtime Adapter / Plugin Contract**：让每个外部 Agent 产品用自己的 adapter 暴露能力，并通过统一 contract 进入 LunaAgentOS。
- **Runtime Session Model**：统一 session、turn、event、lifecycle 和 history，让不同 App 可以一致消费。
- **Agent 共用能力层**：未来把分散在各个 Agent 产品里的 models、tools、skills、MCP servers、profiles、approvals、runtime capabilities 抽出来，再由 LunaAgentOS 统一观测、组织和分发。

## App 的位置

当前 App 很重要，因为它把协议、Adapter 和 Runtime Session Model 变成可使用的产品体验。

它提供：

- 本地控制界面。
- Runtime Session Cards。
- 活会话与归档会话视图。
- Runtime 探测与本地历史。
- Claude Code、Hermes 和未来入口的可视化工作台。

App 承载产品体验，协议、Adapter Host 和 Runtime Session Model 承载运行契约：

```text
protocol / adapter host / runtime session model
  -> App renders normalized sessions and capabilities
  -> users operate real external runtimes through LunaAgentOS
```

## Adapter 原则

新增一个 Agent 产品，通过 Adapter Contract 接入 LunaAgentOS。

目标接入路径是：

```text
new agent product
  -> adapter manifest
  -> adapter implementation
  -> LunaAgentOS unified JSON contract
  -> adapter host
  -> apps render normalized sessions and capabilities
```


有些 adapter 可以主要靠声明式 manifest 完成；复杂产品可能需要一个进程外 plugin，把原生 CLI、ACP server、SDK、Gateway、PTY session 或 IDE bridge 翻译成 LunaAgentOS 的统一事件。

## Runtime surfaces

LunaAgentOS 支持多种底层 runtime surface。

不同 Agent 可能暴露不同 runtime surface：

- **ACP / JSON-RPC over stdio**：结构化 coding-agent session。
- **PTY / terminal**：兼容原生 CLI / TUI。
- **SDK streaming**：官方可编程 agent runtime。
- **Gateway / HTTP / WebSocket**：后台、远程或频道型 Agent。
- **IDE Bridge**：IDE-first 产品。

统一层由 Adapter Contract 和归一化 Runtime Session event model 承担。

## First-party adapters

Claude Code 和 Hermes 是 first-party adapters，用来验证 contract。

它们应该被描述为：

- 具体外部 Agent 产品。
- 真实 runtime entries。
- 证明 Adapter 模型的样板。
- 沉淀统一协议和 capability layer 的来源。

Trae IDE 是 IDE-first adapter path 的 bridge target。

## 架构方向

当前仓库结构已经把协议、核心 seam、adapter 入口和 App 入口放到清晰位置：

```text
protocol/
  schemas/
  examples/

core/
  adapter-host/
  runtime-session/
  capability-model/

adapters/
  first-party/
    claude-code/
    hermes/
    trae-ide/
  legacy/

apps/
  desktop-shell/

docs/
```


后续运行链路抽象继续小步推进，每一步都验证 Claude Code 和 Hermes 当前真实 runtime 路径。

## 设计约束

- **让 App 成为协议的具象化控制台。** 新 runtime 能力通过 Adapter Contract 进入产品体验。
- **新 Agent 产品通过 adapter 接入。** App 渲染归一化后的 sessions 和 capabilities。
- **Runtime surface 保持开放。** ACP 是当前重要路径，PTY、SDK、Gateway、IDE Bridge 都是协议目标。
- **保留原生 Agent 的强项。** Adapter 暴露能力，让不同 Agent 在统一 workspace 中保持各自优势。
- **Adapter Contract 先可信。** 插件生态建立在稳定 manifest、capability 和 Runtime Session event model 之上。

## 当前实现边界

今天仓库里已经有一个可工作的 App 和第一批真实 runtime integration。下一步架构工作必须受这个产品定义指导：

```text
Protocol defines the contract.
Adapters connect external agent products.
Runtime Session Model carries the work.
App makes the system usable.
```

