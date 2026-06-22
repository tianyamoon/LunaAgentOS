# LunaAgentOS 0.2.1 发布说明

[English](./release-notes-0.2.1.md)

LunaAgentOS 0.2.1 把产品表达从“真实 Agent session 工作台”推进到“AI 时代的个人桌面操作系统”：它仍然从真实会话、过程可见和本地历史开始，但更明确地指向多 Agent 工作、资源治理和个人控制面。

这个版本不是一次大范围功能扩张，而是一次产品定位、入口表达和本地运行体验的整理发版。

## 主要变化

- **产品定位升级**：中文 README 和应用顶部文案更新为“AI 时代的个人桌面操作系统”，更贴近个人操作环境、多 Agent 协作和资源治理的长期方向。
- **英文 README 对齐中文主线**：英文版重新按中文 README 结构整理，补齐多 Agent 工作的新问题、账号 / API key / 模型额度管理、下一阶段和长期愿景。
- **OpenAI Codex 进入当前可用入口表达**：README 将 Claude Code、Hermes 和 OpenAI Codex 放在同一层级描述，强调多供应商 Agent 统一入口。
- **下一阶段重新定位**：从“补工作台基础”推进到“个人 Agent 管理层”，覆盖 Agent 资产、预算浪费、跨 Agent 继续工作、协作关系和入口健康状态。
- **本地 App 启动方式修正**：文档统一使用 `npm run tauri dev` 启动桌面应用，构建命令更新为 `npm run tauri build -- --no-bundle`。

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
- 不把 marketplace 或商业平台作为 0.2.1 的发布目标。

## 适合谁尝试

- 已经在用 Claude Code、Hermes 或 Codex，并希望有一个更统一本地工作台的用户。
- 有多个 Agent 账号、订阅、API key 或模型额度，并关心长期管理成本的人。
- 想观察真实 Agent 过程，而不是只看最终回答的开发者。
- 想参与 adapter、runtime session、过程可见性、历史恢复和 Agent control plane 方向的贡献者。

安装与运行细节见 [快速开始](./getting-started.zh-CN.md)。
