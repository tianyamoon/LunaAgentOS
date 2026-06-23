# Adapter 层负责翻译而不同化

LunaAgentOS 通过 Adapter Manifest 和必要的 Adapter Extension 接入外部 Agent Product。Adapter 的职责是把 runtime 身份、能力、健康状态、命令和事件翻译为稳定 contract，而不是把不同 Agent Product 强行改造成同一种内部机制。desktop Shell 只消费归一化 contract，不应写死某个 Adapter 的命令列表、能力事实或 runtime 特例。

## Consequences

- 可声明的稳定事实优先写入 `adapters/registry/<adapter-id>/manifest.json`。
- OS 探测、WSL 路由、profile discovery 和 dynamic targets 等行为放在 Adapter Extension 或 Adapter Host。
- Shell 需要 Adapter 特有 metadata 时，通过通用 Interface 注入，不让通用 Module 绑定具体 Adapter。
