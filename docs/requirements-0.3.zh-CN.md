# LunaAgentOS 0.3 需求定义

[English](./requirements-0.3.md)

0.3 当前阶段先让用户能看懂、配置并可靠使用自己的 Agent，同时保持 Runtime Session 与 Task 的边界清楚。

## 产品对象边界

- **Runtime Session** 是绑定 Agent Entry 的会话环境，负责会话状态、执行过程、响应、历史和恢复。
- **Runtime Session Card** 只呈现一个 Runtime Session，不是 Task，也不承担 Task Board 职责。
- **Task** 是未来可拆分、分派并跨 Runtime Session 跟踪的工作单元。本阶段不实现 Task 数据模型或管理界面。

## 本阶段范围

### Agent 管理

用户可以查看 Agent 身份、运行环境、Profile、工作目录、模型信息、能力边界、安全边界和最佳实践。

- adapter 明确支持 LunaAgentOS 持久配置时，用户可以选择并保存新 Runtime Session 的默认模型。
- 其他 Agent 明确显示模型由原生 runtime 管理；会话内 `/model` 不等同于持久默认模型配置。

### Agent 健康诊断

用户可以查看安装与调用状态、登录或配置需求、Profile、WSL/Bridge、模型或密钥准备情况、版本关注项、具体不可用原因和下一步建议。

诊断结论优先来自真实 runtime、adapter health check 或可验证的本地配置。无法确认的字段显示未知；密钥只检查是否存在，永不显示值，也不因存在就声称有效。

## 本阶段不做

- Session Handoff
- Task Board、Task 管理与自动任务分派
- 自动多 Agent 编排与团队模式
- 共享记忆总线
- Marketplace
- 完整计费平台

Session Card 继续聚焦会话可读性、执行过程、响应、历史与恢复，不引入 Task 字段或 Task 状态。
