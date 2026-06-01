# LunaAgentOS 领域上下文

LunaAgentOS 是 AI 时代的个人 Agent 桌面操作环境。本文固定 App、Core、protocol、adapters 和未来 orchestration 工作使用的领域词汇，避免实现细节悄悄改变产品模型。

## 领域词汇

### Agent 接入

**Agent Product（Agent 产品）**：
保留自身 runtime 行为、权限和交互模型的外部 AI Agent 产品。
_避免使用_：内置 Agent、统一 Agent

**Adapter（适配器）**：
通过 LunaAgentOS contract 暴露某个 Agent Product 的翻译层，不负责同化其原生行为。
_避免使用_：写死在 Shell 中的 provider 集成

**Adapter Manifest（适配器清单）**：
描述 Adapter 身份、transport、启动命令、能力和进程权限的声明式事实。
_避免使用_：UI 常量、Shell 专用能力列表

**Adapter Extension（适配器扩展）**：
无法由 Adapter Manifest 数据表达的 runtime 特有行为，例如操作系统探测、WSL 路由、profile discovery 或 dynamic targets。
_避免使用_：Shell 特例

**Adapter Host（适配器宿主）**：
负责发现 Adapter、解析 runtime 命令、管理进程和发出归一化 Runtime Event 的 Core runtime 层。
_避免使用_：桌面 UI 逻辑

**Runtime Surface（运行时接入面）**：
Agent Product 暴露的原生执行通道，例如 ACP、CLI、PTY、gateway、SDK 或 IDE bridge。
_避免使用_：Agent Product

**Provider（提供方）**：
在 Agent Fleet 中对同一个 Adapter 所暴露入口进行分组的家族级对象。
_避免使用_：Agent Entry、Runtime Instance

**Runtime Instance（运行环境实例）**：
某个 Provider 被探测到的执行环境，例如 Windows、WSL 或 IDE bridge。
_避免使用_：Agent Entry、Profile

**Profile（职责配置）**：
可以产生独立 Agent Entry 的 runtime 原生命名配置。
_避免使用_：Provider

**Agent Entry（Agent 入口）**：
Agent Fleet 中可选择的执行目标，由 Provider、Runtime Instance 和可选 Profile 共同确定。
_避免使用_：Agent Product、Provider

**Agent Fleet（Agent 舰队）**：
用户查看 Agent Entry、健康状态和配置的工作区区域。
_避免使用_：启动器列表

**Current Send Target（当前发送目标）**：
默认接收下一条用户输入的 Agent Entry。
_避免使用_：当前活跃 session

### Runtime 工作

**Runtime Session（运行时会话）**：
绑定到一个 Agent Entry 的持久本地工作上下文，包含 turns、lifecycle、runtime binding 和 history metadata。
_避免使用_：Task、聊天消息、一次性 prompt

**Turn（执行轮次）**：
Runtime Session 内的一次用户请求及其 runtime 执行。
_避免使用_：Runtime Session、Task

**Prompt Run（提示执行）**：
Turn 对应的一次真实 runtime 执行。`promptRunId` 是流事件写入租约；只有同时匹配 Runtime Session、Turn 和 Prompt Run 的事件才能修改用户正文。
_避免使用_：根据当前 active Turn 猜测事件归属

**Follow-up Queue（后续输入队列）**：
Runtime Session 正在执行时保存用户后续输入的 FIFO 队列。队列项在真正开始执行前不创建 Turn；当前 Prompt Run 成功结束后才自动启动下一项。
_避免使用_：同一 Runtime Session 内伪造并发 Turn

**Runtime Event（运行时事件）**：
Turn 执行期间发出的归一化观测，例如 thought、tool、plan、usage、state、response 或 error。
_避免使用_：原始日志行

**Turn Timeline（轮次时间线）**：
按照到达顺序保存 Runtime Event 的 Turn 内过程投影。执行中保留 Thinking、Tool、Permission、File Change、Runtime Event 和 Assistant 片段的因果顺序；完成后可收敛为 Worked for 摘要。
_避免使用_：按事件类型拆开的固定面板、精确回放旧历史

**Runtime MessageList（运行时连续消息流）**：
Runtime Session Card 内部面向阅读的连续消息投影。它把一个或多个 Turn Timeline 转换为稳定消息行；Turn 仍是内部执行语义，但不是默认视觉容器。
_避免使用_：第 N 轮套娃卡片、按消息类型拆开的固定区域

**Runtime Binding（运行时绑定）**：
Runtime Session 与当前前端进程、协议连接之间的附着状态。
_避免使用_：Session Lifecycle

**Session Lifecycle（会话生命周期）**：
Runtime Session 的持久状态，例如 live、stopped、archived、restoring、resume_failed 或 deleted。
_避免使用_：Runtime Binding

**History Entry（历史条目）**：
Turn 的本地持久记录，可用于组成 archived transcript 和恢复行为。
_避免使用_：活跃 Runtime Session

**Runtime Session Card（运行时会话卡片）**：
在工作区中渲染一个 Runtime Session 的界面，展示当前摘要、过程可见性和可用动作。
_避免使用_：Task、Task Board、通用聊天气泡

**Workspace Focus（工作区聚焦）**：
突出展示一张 Runtime Session Card，同时保留工作区控制能力的视图模式。
_避免使用_：Session Lifecycle、持久化 fullscreen 字段

### 未来 Orchestration

**Task（任务）**：
未来可以被拆分、分派，并独立于单个 Runtime Session 跟踪的可调度工作单元。
_避免使用_：Runtime Session、Turn

**Task Board（任务看板）**：
未来用于跨 Agent Entry 跟踪 Task 与分派关系的 orchestration 界面。
_避免使用_：Runtime Session workspace

**Handoff（交接）**：
由用户明确触发，把选定上下文从一个 Runtime Session 转移到另一个 Agent Entry 或 Runtime Session。
_避免使用_：自动多 Agent orchestration

## 关系

- 一个 **Agent Product** 通过一个或多个 **Adapter** 暴露。
- 一个 **Adapter** 在 **Adapter Manifest** 中声明稳定事实，并可把 runtime 特有行为交给 **Adapter Extension**。
- **Adapter Host** 发现 **Adapter** 并解析其 **Runtime Surface**。
- 一个 **Provider** 聚合一个或多个 **Runtime Instance**。
- 一个 **Runtime Instance** 暴露一个或多个 **Agent Entry**，可以包含 runtime 原生 **Profile**。
- **Current Send Target** 指向且只指向一个可选择的 **Agent Entry**。
- 一个 **Runtime Session** 属于且只属于一个 **Agent Entry**，并包含零个或多个 **Turn**。
- 一个 **Runtime Session** 同时最多拥有一个活跃 **Prompt Run**；运行中的后续输入进入 **Follow-up Queue**。
- 一个 **Turn** 产生零个或多个 **Runtime Event**，并可持久化为 **History Entry**。
- 一个 **Prompt Run** 为一个 **Turn** 提供流事件写入租约；迟到或身份不匹配事件不得进入用户正文。
- 一个 **Turn Timeline** 按到达顺序投影一个 **Turn** 的 **Runtime Event**；旧历史只能近似重建。
- 一个 **Runtime MessageList** 把一个 **Runtime Session** 的内部 Turn Timeline 投影为连续、稳定的阅读流。
- 一张 **Runtime Session Card** 渲染且只渲染一个 **Runtime Session**。
- **Workspace Focus** 最多选择一张 **Runtime Session Card**，不改变该 session 的领域状态。
- 未来一个 **Task** 可以创建或协调多个 **Runtime Session**。
- **Handoff** 明确转移选定上下文，不代表共享记忆总线或自动 orchestration。

## 示例对话

> **开发者**：“用户聚焦了一张 Hermes 卡片。要不要把 `fullscreen` 持久化到 Runtime Session？”
>
> **领域专家**：“不要。Workspace Focus 是视图状态，Runtime Session 仍然是原来的持久工作上下文。”
>
> **开发者**：“Session Card 能不能直接变成 Task Board？”
>
> **领域专家**：“不能。Runtime Session Card 可以总结工作，但未来一个 Task 可能协调多个 Runtime Session。”
>
> **开发者**：“Hermes profile discovery 应该放在哪里？”
>
> **领域专家**：“放在 Adapter seam 后面。Shell 只消费归一化 Agent Entry，不应绑定具体 Adapter。”

## 已澄清的歧义

- “Agent” 曾同时表示外部产品、Fleet 分组和可选择目标。分别使用 **Agent Product**、**Provider** 和 **Agent Entry**。
- “session active” 曾同时表示持久 lifecycle 和进程连接状态。分别使用 **Session Lifecycle** 和 **Runtime Binding**。
- “fullscreen” 曾表示工作区展示模式。统一使用 **Workspace Focus**；它不是 Runtime Session 字段。
- “Session Card 任务化”容易被误解为 Runtime Session 等同于 **Task**。**Runtime Session Card** 可以展示任务式摘要，但 **Task** 和 **Task Board** 仍是独立的未来 orchestration 概念。

## 当前模块边界

以下边界已经进入代码，并作为后续修改的默认落点：

- Rust Core 的 `lib.rs` 只负责 Tauri composition root。配置、History Repository、Adapter Host、Runtime Probe 和 Runtime Session Commands 分别位于独立模块。
- 前端 `historyRepository` 统一管理 History invoke、内存快照、schema 兼容、归档和删除。视图与控制器不应绕过它直接操作 History 后端。
- `sessionRestoreController`、`sessionLifecycleController`、`sessionExecutionController` 和 `sessionLaunchController` 分别负责恢复、生命周期、执行和发送启动流程。
- `sessionPromptQueueController` 管理运行中输入的 FIFO 队列。队列不提前创建 Turn，失败、取消、停止、归档或删除时不自动误发后续输入。
- `workspaceViewStore` 独立保存 **Workspace Focus**。切换工作区 session 时，不再把 `fullscreen` 写入 Runtime Session。
- `composerController` 管理输入框、附件、斜杠菜单和键盘发送模式。
- `agentFleetView` 与 `agentManagementView` 只消费归一化 Provider、Agent Entry 和 Availability 数据，不包含具体 Adapter 的运行规则。
- `runtimeSessionCardView` 与 `runtimeSessionCardController` 管理卡片外层和交互，避免把大段工作区实现重新塞回 `main.js`。
- `turnTimeline` 与 `turnTimelineProjection` 保存并整理 Turn 内部有序事件事实。
- `runtimeSessionMessageListProjection` 与 `runtimeSessionMessageListView` 把内部 Turn Timeline 转换为连续消息行。执行完成后，过程收敛为可展开的 Worked for 摘要，最终 Assistant Markdown 是默认主体。
- `stickToBottom` 管理桌面 WebView 中的滚动跟随意图。用户介入滚动后暂停自动跟随，新 Prompt 到来时显式定位到对应 user row。
- `scripts/check-architecture.mjs` 是渐进式架构护栏。它阻止 Shell 重新引入具体 Adapter 特判、History invoke 绕过 Repository、View 直接修改 Store 对象，以及 Rust 专用 ACP 入口复活。

## 兼容策略

- History schema 5 使用通用 `agentEntrySnapshot` 保存 Runtime Session 对应的 Agent Entry 快照。
- schema 4 和旧 `hermesProfile` 仅保留读取兼容；新写入路径不得继续产生专用字段。
- 缺少 `promptRunId` 的旧 Turn 标记为 `legacy_unverified`。系统保留原文并提示可能存在旧版事件归属问题，不根据文本相似度自动删改历史。
- `main.js` 仍处于逐步收缩阶段。新增领域实现必须进入职责明确、可测试的 Module，不能以临时方便为理由扩大 Shell。
