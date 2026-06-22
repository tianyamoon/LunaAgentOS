# LunaAgentOS 0.3.0 发布说明

[English](./release-notes-0.3.md)

LunaAgentOS 0.3.0 在 runtime session 工作台之上，把两件基础能力做扎实：**Agent 管理**（身份、profile、模型、能力、安全边界、最佳实践）和**真实健康诊断**。本版本继续严格区分 Runtime Session 与 Task —— Task、Handoff 和编排仍属于后续阶段。

完整范围定义见 [0.3 需求定义](./requirements-0.3.zh-CN.md)。

## Agent 管理

- **Agent 身份与运行信息**：每个 Agent 展示名称、provider、profile、账号身份、运行环境、运行命令和默认工作目录。
- **模型控制如实表达**：支持 LunaAgentOS 持久配置的 adapter，可选择并保存新 Runtime Session 的默认模型；其他 Agent 明确显示模型由原生 runtime 管理，会话内 `/model` 不等同于持久默认配置。
- **能力矩阵**：按 Agent 呈现文件、命令、网络、图像、浏览器和本地仓库能力。
- **安全边界与最佳实践**：每个 Agent 展示自己的安全边界和推荐用途。
- **由 manifest 驱动，不是纯 UI 文案**：能力和模型信息来自 adapter manifest，让管理反映真实 adapter 事实，而非前端硬编码文本。

## 真实健康诊断

健康结论来自真实 runtime 探测、adapter health check 或可验证的本地配置，绝不靠猜测。

- **真实探测**：安装 / 可调用 / 登录 / 配置 / WSL 或 Bridge / 模型或密钥 / 版本，均由实际执行 runtime 命令得出，不是占位数据。
- **如实标记未知**：无法确认的字段显示 `unknown`，绝不伪装成健康；除非至少有一项被正向验证，否则不会把 Agent 报告为可用。
- **凭据安全**：密钥只检查是否存在，永不显示值，也不因存在就声称有效；诊断输出会对含密信息的行做脱敏。
- **证据链**：每个健康字段可显示其来源和检测时间，让状态可追溯而非黑盒。
- **交互式修复动作**：不可用项提供可操作的下一步 —— 复制修复命令、打开对应配置对话框，或就地重新探测。

## 输入区图片输入

输入区现在支持图片，可发送给具备多模态能力的 runtime。

- 从剪贴板粘贴图片或拖入输入区；附件托盘中显示缩略图预览。
- 图片作为 ACP image content block（base64）发送，与文本 prompt 分离，绝不拼进 prompt 字符串。
- 图片输入由 runtime 上报的 ACP `promptCapabilities.image` 门控；不支持图片的 Agent 会阻止粘贴并明确提示，而非静默丢弃。
- 边界保护：图片类型白名单（png/jpeg/gif/webp，排除 svg），以及单图大小上限。

## Runtime Session Card

Session Card 继续聚焦会话可读性、执行过程、响应、历史与恢复。Runtime Session 使用 `title`，Turn 使用 `prompt`，不引入 Task 字段或 Task 状态。

- 历史日文件写入改为串行化，避免并发轮次下的更新丢失。
- ACP 读取器对字节边界更宽容，增强流式对残帧的健壮性。

## 仍然有效的基础能力

- Windows 优先的本地桌面工作台。
- Claude Code、Hermes 和 OpenAI Codex Manifest 入口表达。
- Runtime Session Card 展示 output、thought、runtime events 和 final response。
- live sessions、history sessions 和 archived sessions 分区。
- 本地 JSON session history、恢复和只读归档打开。
- zh-CN / en-US UI 语言本地持久化切换。

## 这个版本有意不宣称什么

- 不包含 Session Handoff。
- 不包含 Task Board、Task 管理或自动任务分派。
- 不提供自动多 Agent 编排或 Team Mode。
- 不承诺共享记忆总线。
- 不包含 marketplace 或完整计费平台。

安装与运行细节见 [快速开始](./getting-started.zh-CN.md)。
