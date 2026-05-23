# LunaAgentOS Docs

这里是 LunaAgentOS 面向外部开发者的公开文档入口。文档重点放在产品定义、协议/Adapter 方向、当前运行方式、架构边界和未来路线。

## Start

- [Getting Started](./getting-started.md)：本地运行、构建和演示模式
- [Current product boundary](./current-boundary.md)：当前能做什么、不做什么
- [Contributing](../CONTRIBUTING.md)：适合参与的方向

## Concepts

- [Product definition](./product-definition.md)：协议、Adapter / Plugin、Runtime Session Model 与 App 的关系
- [Why LunaAgentOS](./why-lunaagentos.md)：为什么需要异构 Agent 控制层
- [Light core principles](./light-core-principles.md)：轻核心原则
- [Roadmap](./roadmap.md)：从桌面工作台走向调用流、协作工作台和控制平面

## Architecture

- [Architecture overview](./architecture-overview.md)：当前架构分层与演进方向
- [Protocol](../protocol/README.md)：统一协议、schema 与示例
- [Adapters](../adapters/README.md)：first-party adapters 与 adapter 入口
- [Apps](../apps/README.md)：LunaAgentOS App 入口
- [Hermes ACP runtime](./hermes-acp-profile-runtime.md)：Hermes ACP / profile runtime 接入说明
- [Hermes TUI direction](./hermes-tui-direction.md)：Hermes 过程可见和活会话体验
- [Trae IDE bridge notes](../bridges/trae-ide/README.md)：Trae IDE Bridge 边界

## Code entry points

- [`protocol/`](../protocol/)：Adapter manifest、Runtime Session 和 Runtime Event contract
- [`core/`](../core/)：Adapter Host、Runtime Session 和 Capability Model 目标 seam
- [`adapters/`](../adapters/)：first-party adapters、legacy POC 和 adapter 入口
- [`apps/desktop-shell/`](../apps/desktop-shell/)：LunaAgentOS App 工程
- [`apps/desktop-shell/src/`](../apps/desktop-shell/src/)：前端工作台
- [`apps/desktop-shell/src-tauri/src/`](../apps/desktop-shell/src-tauri/src/)：Rust runtime / history / ACP 命令

## Documentation rule

公开文档聚焦当前状态和未来方向，优先帮助外部开发者理解、运行和参与项目。
