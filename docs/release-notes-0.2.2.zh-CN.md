# LunaAgentOS 0.2.2 发布说明

[English](./release-notes-0.2.2.md)

LunaAgentOS 0.2.2 是一个小版本 bugfix 发布，重点修复 provider 图标在生产构建里的资源路径与打包问题，并把图标身份继续收敛到 adapter manifest。

## 修复与改进

- **修复生产构建图标资源不可见的问题**：provider 图标改为通过稳定的 public/runtime asset 路径提供，避免 Vite 生产构建后静态图标没有被正确打包或引用。
- **图标身份跟随 adapter manifest**：Claude Code、Codex、Hermes、Trae 等入口的图标信息进一步放回 adapter registry，让 provider identity 更接近真实入口定义。
- **支持 manifest-driven adapter icons**：manifest-backed provider 可以带出自己的图标资源，减少前端硬编码图标映射。
- **补充 0.3 需求文档**：新增 0.3 方向文档，继续梳理 Agent 资产管理、协作流和 control-plane 能力。

## 仍然有效的基础能力

- Windows 优先的本地桌面工作台。
- Claude Code、Hermes 和 OpenAI Codex 入口表达。
- Runtime Session Card 展示 output、thought、runtime events 和 final response。
- Session Card 事件流、Focus 主视图、Agent 原生命令入口和 provider identity。
- live sessions、history sessions 和 archived sessions 分区。
- 本地 JSON session history、恢复和只读归档打开。
- zh-CN / en-US UI 语言本地持久化切换。

## 这个版本有意不宣称什么

- 不是完整多 Agent 自动协作系统。
- 不是完整 orchestration 平台。
- 不提供 Team Mode。
- 不承诺完整共享记忆总线。
- 不把所有外部 runtime 压成同一种内部 Agent。
- 不把 marketplace 或商业平台作为 0.2.2 的发布目标。

安装与运行细节见 [快速开始](./getting-started.zh-CN.md)。
