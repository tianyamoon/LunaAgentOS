# LunaAgentOS Docs

这里是 LunaAgentOS 面向外部开发者的公开文档入口。文档重点放在当前产品形态、运行方式、架构边界和未来方向。

## Start

- [Getting Started](./getting-started.md)：本地运行、构建和演示模式
- [Current product boundary](./current-boundary.md)：当前能做什么、不做什么
- [Contributing](../CONTRIBUTING.md)：适合参与的方向

## Concepts

- [Why LunaAgentOS](./why-lunaagentos.md)：为什么需要异构 Agent 控制层
- [Light core principles](./light-core-principles.md)：轻核心原则
- [Roadmap](./roadmap.md)：从桌面工作台走向调用流、协作工作台和控制平面

## Architecture

- [Architecture overview](./architecture-overview.md)：当前架构分层与演进方向
- [Hermes ACP runtime](./hermes-acp-profile-runtime.md)：Hermes ACP / profile runtime 接入说明
- [Hermes TUI direction](./hermes-tui-direction.md)：Hermes 过程可见和活会话体验
- [Trae IDE bridge notes](../bridges/trae-ide/README.md)：Trae IDE Bridge 边界

## Code entry points

- [`desktop-shell/`](../desktop-shell/)：Tauri 2 桌面壳工程
- [`desktop-shell/src/`](../desktop-shell/src/)：前端工作台
- [`desktop-shell/src-tauri/src/`](../desktop-shell/src-tauri/src/)：Rust runtime / history / ACP 命令

## Documentation rule

公开文档聚焦当前状态和未来方向，优先帮助外部开发者理解、运行和参与项目。
