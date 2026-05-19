# LunaAgentOS v1 验收清单

## v1 边界

v1 的目标是先替代 Claude CLI 的使用入口，而不是做完整多 Agent 编排平台。

必须保持的主链路：

1. 启动桌面控制台。
2. 左侧展示 provider / agent 舰队。
3. 右侧后台加载本地历史任务。
4. 用户设定主 Agent。
5. 用户输入任务并发送给主 Agent。
6. 中间工作台创建 agent 会话卡片。
7. 卡片承载输出流、思考流、最终响应与错误状态。
8. 会话结果写入按日期归档的历史 JSON。

## 明确不做

- 复杂多 Agent 调度。
- 调用流编排。
- 独立工具大面板。
- 启动时自动拉起真实 CLI。
- 点击左侧 Agent 刷新主工作区。
- 把 Trae IDE 伪装成 CLI。

## 启动与静默体验

- [ ] 应用首屏先展示工作台骨架。
- [ ] 启动时不自动拉起 Claude runtime。
- [ ] 启动时不弹出 CLI 命令窗口。
- [ ] 历史任务后台异步加载。
- [ ] 历史加载失败不阻塞主界面。
- [ ] 单个损坏 history JSON 不影响其它历史加载。
- [ ] 占位反馈走状态条，不弹窗打断用户。

## 左侧：舰队与配置区

- [ ] 左侧显示 provider / agent 舰队。
- [ ] 可以明确设定主 Agent。
- [ ] 主 Agent 设定可持久化。
- [ ] 点击左侧 Agent 不刷新主工作区。
- [ ] Hermes 显示为已探测但未接通真实执行链路。
- [ ] Trae 只保留产品位，不伪装成 CLI。

## 中间：主 Agent 会话工作台

- [ ] 启动时中间工作台可以为空。
- [ ] 发送任务后卡片先入场。
- [ ] Claude 后台运行，不阻塞 UI 入场。
- [ ] 每个会话卡片有独立滚动区域。
- [ ] 卡片顶部只展示轻量信息：Agent、状态、当前任务。
- [ ] 卡片展示输出、思考、最终响应。
- [ ] 错误状态可见且不导致 UI 卡死。
- [ ] 当前接收输入的会话/Agent 清晰可辨。
- [ ] 卡片支持全屏查看。

## 主 Agent 发送链路

- [ ] 输入框任务默认只发给主 Agent。
- [ ] `发送` 与 `发给主 Agent` 当前语义一致。
- [ ] 没有主 Agent 时给出状态条提示。
- [ ] 发送中按钮进入 loading/disabled 状态。
- [ ] Claude runtime 错误能归类展示。
- [ ] prompt 失败后不丢失当前 turn transcript。

## Claude ACP / RuntimeSession

- [ ] Claude 是 v1 主路径。
- [ ] runtime session id 与 ACP session id 不混淆。
- [ ] 新会话能创建真实 runtime session。
- [ ] 多轮任务能保留在同一个 session card 下。
- [ ] 用户强制新会话时创建新的 session card。
- [ ] 归档/释放 runtime 后状态正确更新。
- [ ] runtime 死亡后 UI 能降级而不误导用户继续发送。
- [ ] 窗口关闭时清理 ACP 子进程。

## 右侧：历史任务

- [ ] 右侧从本地 JSON 读取历史。
- [ ] 历史按日期归档或可按日期理解。
- [ ] 历史条目包含 provider / agent / task / status / summary。
- [ ] 历史条目包含 schemaVersion。
- [ ] 历史 compact 能去重。
- [ ] compact 只在有变更时写回文件。
- [ ] compact 统计去重、升级与跳过坏文件数量。
- [ ] 历史区不承担复杂监控系统职责。

## 真实桌面终检

- [ ] 打开 release exe，观察启动是否有明显卡顿。
- [ ] 打开 release exe，观察启动是否有命令框闪出。
- [ ] 点击 `刷新状态`，观察是否有命令框闪出。
- [ ] 点击 `发送`，观察是否有命令框闪出。
- [ ] 连续发送 2-3 个 Claude 任务，确认卡片与历史正常。
- [ ] 重启应用，确认历史仍可读取。

## Wiki 与交付要求

- [ ] 如修改 llm-wiki，先读 `F:\wiki\ailearing\SCHEMA.md` 与 `F:\wiki\ailearing\index.md`。
- [ ] 修改 `concepts/` 时同步更新 `index.md`。
- [ ] 修改 wiki 时追加 `log.md`。
- [ ] 修改 wiki 后在 `F:\wiki\ailearing` 本地提交。
- [ ] 禁止修改 `F:\wiki\trade-system`。
- [ ] 禁止修改 `F:\wiki\social-media`。
- [ ] 代码或文档变更后在 LunaAgentOS repo 本地提交。
- [ ] 不主动 push。
