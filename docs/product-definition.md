# 产品定义

LunaAgentOS 是一个以协议为核心的异构 Coding Agent 操作层；桌面壳只是消费这套协议的第一个参考 App，不是产品灵魂本身。

## 核心身份

LunaAgentOS 要解决的是不同 Agent 产品之间缺少统一控制层的问题。

产品核心是：

- **统一 JSON Contract**：稳定描述 adapter manifest、runtime session、event、tools、models、skills、MCP resources、permissions、routing metadata 和 history。
- **Runtime Adapter / Plugin Contract**：让每个外部 Agent 产品用自己的 adapter 暴露能力，而不是让 LunaAgentOS core 或 app 为每个新产品改代码。
- **Runtime Session Model**：统一 session、turn、event、lifecycle 和 history，让不同 App 可以一致消费。
- **Agent 共用能力层**：未来把分散在各个 Agent 产品里的 models、tools、skills、MCP servers、profiles、approvals、runtime capabilities 抽出来，再由 LunaAgentOS 统一观测、组织和分发。

## App 的位置

当前 desktop shell 很重要，因为它用真实外部 runtime 证明了这套模型。

它提供：

- 本地控制界面。
- Runtime Session Cards。
- 活会话与归档会话视图。
- Runtime 探测与本地历史。
- Claude Code、Hermes 和未来入口的可视化工作台。

但 App 不是架构中心。正确关系应该是：

```text
protocol / adapter host / runtime session model
  -> apps consume normalized state
  -> desktop-shell is the first app
```

不是：

```text
desktop-shell
  -> adapters are internal UI configuration
```

## Adapter 原则

新增一个 Agent 产品，不应该要求修改 LunaAgentOS core 或 app。

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

LunaAgentOS 不应该强迫所有 Agent 使用同一种底层传输。

不同 Agent 可能暴露不同 runtime surface：

- **ACP / JSON-RPC over stdio**：结构化 coding-agent session。
- **PTY / terminal**：兼容原生 CLI / TUI。
- **SDK streaming**：官方可编程 agent runtime。
- **Gateway / HTTP / WebSocket**：后台、远程或频道型 Agent。
- **IDE Bridge**：IDE-first 产品。

统一层不是某一种 native transport。统一层是 Adapter Contract 和归一化 Runtime Session event model。

## First-party adapters

Claude Code 和 Hermes 是 first-party adapters，用来验证 contract。

它们应该被描述为：

- 具体外部 Agent 产品。
- 真实 runtime entries。
- 证明 Adapter 模型的样板。
- 沉淀统一协议和 capability layer 的来源。

它们不应该被描述成 LunaAgentOS 的产品定义本身。

Trae IDE 仍是 bridge target 和未来 adapter 方向。它应该保持可见，但不能伪装成已经原生接入。

## 架构方向

仓库和代码应该逐步靠近这个概念结构：

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
  examples/

apps/
  desktop-shell/

docs/
```


当前代码不需要一次性跳到这个结构。迁移必须小步进行，每一步都要验证 Claude Code 和 Hermes 当前真实 runtime 路径没有崩。

## 设计约束

- **不要让 desktop-shell 成为产品中心。** 它是参考 App。
- **不要通过 app 内部 switch statement 增加新 Agent 产品。** 新产品应该通过 adapter 接入。
- **不要把 ACP 当成唯一协议。** ACP 是重要 runtime surface，但不是唯一可能。
- **不要抹平原生 Agent 的强项。** Adapter 要暴露能力，而不是把所有 Agent 都压成弱聊天器。
- **当前不要做插件市场。** 先让 Adapter Contract 可信。

## 当前实现边界

今天仓库里已经有一个可工作的 desktop shell 和第一批真实 runtime integration。它们很有价值，但下一步架构工作必须受这个产品定义指导：

```text
Protocol first.
Adapter/plugin second.
Runtime session model third.
Apps last.
```

