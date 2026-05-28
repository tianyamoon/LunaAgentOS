# LunaAgentOS 0.2 Preview 发布说明

[English](./release-notes-0.2-preview.md)

LunaAgentOS 0.2 Preview 继续聚焦一个目标：让真实 Agent session 在桌面工作台里更清楚、更可控、更少打断用户的工作节奏。

这个版本不是一次大而全的能力扩张，而是把 0.1 的可运行切片打磨成更像产品的工作区：过程更可见，单个 session 更舒服，runtime 身份更清楚，Agent 原生命令也能从工作台里被发现和插入。

## 0.2 指向的下一阶段

0.2 的意义不只是多了几项界面能力。它开始把 LunaAgentOS 从“能把多个 Agent session 摆在同一个地方”，推向“人真的愿意把一段工作交给这里承载、追踪、恢复和收尾”的工作台。

下一阶段会继续补强这个承载力：让 Claude Code 和 Hermes entry 更稳定，让本地历史、恢复和 archived transcript 更可信，让 Runtime Session Card 更像可理解、可继续的工作对象，并把 adapter contract、Trae IDE bridge 和可控的 session handoff 继续往前推进。

更长期看，LunaAgentOS 不想停在一个好用的 desktop shell。它要继续长成一个中立的 Agent Desktop Environment，并最终成为面向异构 Agent 产品的 operating layer：不同 runtime 保留自己的形状，人类仍然掌握路由、审批、权限和结果回收，而共享配置、工具、记忆和 profile 不再碎裂在每一个 Agent 设置里。

## 主要变化

- **Session Card 事件流**：thought、tool、plan、usage、error 等过程信息被整理为结构化事件节点，streaming 时展开，完成后收起，既保留过程，也减少噪音。
- **Focus 主视图**：原来的全屏遮罩被工作区内聚焦视图替代，用户可以专注单个 session，同时底部输入区保持可见可用。
- **Agent 原生命令入口**：支持通过 slash command 发现并插入 runtime 暴露的原生命令，为后续不同 adapter 的能力表达打基础。
- **Provider identity**：新增 provider icons 与 runtime identity 表达，让 Claude Code、Hermes 和其他 entry 在工作区中更容易区分。
- **更清楚的多 session 表达**：Session Card 头部、状态统计、任务描述和操作区重新整理，当前工作与历史会话的边界更清楚。

## 仍然有效的基础能力

- Windows 优先的本地桌面工作台。
- Claude Code 和 Hermes 真实 runtime entry。
- Runtime Session Card 展示 output、thought、runtime events 和 final response。
- live sessions 与 archived sessions 分区。
- 本地 JSON session history、恢复和只读归档打开。
- zh-CN / en-US UI 语言本地持久化切换。
- Trae IDE bridge 作为后续 IDE-first 路线保留。

## 这个版本有意不做什么

- 不是完整多 Agent 自动协作系统。
- 不是完整 orchestration 平台。
- 不提供 Team Mode。
- 不把远程入口表达为已可用能力。
- 不承诺完整共享记忆总线。
- 不把所有外部 runtime 压成同一种内部 Agent。
- 不把 marketplace 或商业平台作为 0.2 的发布目标。

## 适合谁尝试

- 已经在用 Claude Code 或 Hermes，并希望有一个更清楚本地工作台承载 session 的用户。
- 想观察真实 Agent 过程，而不是只看最终回答的开发者。
- 想参与 adapter、runtime session、过程可见性、历史恢复等方向的贡献者。
- 关心 LunaAgentOS 未来 Human Command Workspace 方向的人。

安装与运行细节见 [快速开始](./getting-started.zh-CN.md)。
