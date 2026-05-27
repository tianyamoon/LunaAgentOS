# LunaAgentOS 文档

[English](./README.md)

这里是 LunaAgentOS 的中文文档入口。

如果你是第一次进入仓库，建议先回答三个问题：

- 它现在到底是什么？
- 我怎么在本地跑起来？
- 我可以从哪里开始参与？

## 先看这些

- [快速开始](./getting-started.zh-CN.md)：安装依赖、运行桌面应用、验证当前工作台
- [0.2 Preview 发布说明](./release-notes-0.2-preview.zh-CN.md)：本次 preview 的新增能力、保留边界和适合人群
- [当前产品边界](./current-boundary.zh-CN.md)：LunaAgentOS 现在是什么，不是什么，哪些内容暂时不做
- [贡献指南](../CONTRIBUTING.zh-CN.md)：开发环境、测试命令、贡献方向、PR 预期

## 产品与概念

- [产品定义](./product-definition.zh-CN.md)：产品形态、核心组成和 adapter 路径
- [为什么做 LunaAgentOS](./why-lunaagentos.zh-CN.md)：这个项目试图解决什么问题
- [轻核心原则](./light-core-principles.zh-CN.md)：控制层要保持聚焦的约束条件
- [路线图](./roadmap.zh-CN.md)：近期和中长期方向

## 架构与接入

- [架构概览](./architecture-overview.zh-CN.md)：当前分层与职责
- [Hermes ACP Runtime](./hermes-acp-profile-runtime.zh-CN.md)：Hermes runtime 语义与 profile 加载
- [Hermes TUI 方向](./hermes-tui-direction.zh-CN.md)：活会话可见性的设计方向
- [Protocol](../protocol/README.md)（暂仅英文）：schema、示例和公开契约
- [Adapters](../adapters/README.md)（暂仅英文）：adapter 边界和首批接入
- [Core](../core/README.md)（暂仅英文）：adapter host、runtime session 和 capability model
- [Apps](../apps/README.md)（暂仅英文）：基于协议构建的产品形态
- [Trae IDE Bridge](../bridges/trae-ide/README.md)（暂仅英文）：IDE-first bridge 路线

## 社区与政策

- [安全策略](../SECURITY.zh-CN.md)：如何报告安全敏感问题
- [商标与品牌使用说明](../TRADEMARKS.zh-CN.md)：代码许可与品牌使用边界

## 英文入口

- [English docs index](./README.md)
- [Getting Started](./getting-started.md)
- [Current Product Boundary](./current-boundary.md)
- [Product Definition](./product-definition.md)
- [Why LunaAgentOS](./why-lunaagentos.md)
- [Light-Core Principles](./light-core-principles.md)
- [Roadmap](./roadmap.md)
- [Architecture Overview](./architecture-overview.md)
- [Hermes ACP Runtime](./hermes-acp-profile-runtime.md)
- [Hermes TUI Direction](./hermes-tui-direction.md)

## 代码入口

- [`protocol/`](../protocol/)（暂仅英文）：adapter manifest、Runtime Session 和 Runtime Event contracts
- [`core/`](../core/)（暂仅英文）：adapter host、runtime session 和 capability model
- [`adapters/`](../adapters/)（暂仅英文）：plugin manifests、built-in adapter extensions 和 integration boundary
- [`apps/`](../apps/)（暂仅英文）：基于协议构建的产品形态
- [`bridges/`](../bridges/)（暂仅英文）：面向 IDE-first integrations 的 bridge 路径
