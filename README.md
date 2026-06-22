<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">AI Agent 时代的个人桌面操作系统</h1>

<p align="center">
  让分散的 Agent 工作，回到一个统一的个人操作环境。
</p>

<p align="center">
  <a href="./README.en.md">English</a>
</p>

**LunaAgentOS 0.3.0**

LunaAgentOS 是为多 Agent 工作与协作而生的个人桌面操作环境。

它把各类 Agent 工具放进同一个桌面入口里，包括 Claude Code、Hermes 和 OpenAI Codex Manifest，让你在一个地方发起任务、查看过程、切换会话、找回历史，而不是在不同工具之间来回搬运上下文。

**人类指挥。Agents 执行。工作台记住一切。**

![LunaAgentOS 桌面预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## Agent 工作的新问题

AI Agent 已经开始承担真实工作，但新的问题也随之出现：人不再只是和一个工具对话，而是在多个 Agent、多个会话、多个执行过程之间做判断。

单个 Agent 可以完成任务，但多个 Agent 放在一起，就会出现新的工作负担：

- 谁接过任务，谁还在运行，谁已经给出结果
- 哪些过程值得保留，哪些上下文可以继续交给另一个 Agent
- 哪个结果是最终版本，哪个只是中间材料
- 什么时候需要人确认，什么时候可以继续执行

还有另一层更现实的负担：账号、订阅、API key、模型额度和试用期越来越多。哪个还有效，哪个已经过期，哪个还在花钱，哪个已经废弃，都不应该靠人凭记忆管理。

LunaAgentOS 想解决的不是“再造一个 Agent”，而是给多 Agent 工作一个可以被人指挥、观察、交接、回收和治理的桌面环境，让工作和资源都少一点浪费。

## 我们想做的产品

LunaAgentOS 不是想把所有 Agent 压扁成一个通用聊天壳，而是想让真实的 Agent 工作少一点割裂、少一点重复、少一点被工具牵着走。

这个产品想法有四个支点：

### 1. Human Command Workspace

目标不是再给用户一个需要照看的控制面板，而是让工作台把工具边界吸收掉，让用户把注意力留在工作本身：

- 决定下一条任务发给谁
- 有意识地注入上下文
- 让执行过程保持可见
- 在需要时介入审批或纠偏
- 把结果回收到同一个工作台

### 2. 有呼吸感的工作台

Agent 不应该像联系人列表一样，永远静态地挂在屏幕上。

更理想的 LunaAgentOS 应该让 Agent 工作呈现出“有进有退”的呼吸感：

- 没事时静默
- 有任务时被唤醒
- 执行中占据舞台
- 完成后折叠归档

### 3. 中立的 Agent 桌面环境

LunaAgentOS 不是把 Claude Code、Hermes、Trae 或未来更多 runtime 收编成一个内置超级 Agent。

它允许用户把自己已经信任的 agents 带进来，保持这些 agents 的可辨识性和原生能力，同时不再为每一次跨工具工作去重新适应一套新的表面。

### 4. Agent 混乱之上的 OS 层

更长远的目标，是把多 Agent 的 O(N) 痛苦压成 O(1)：

- 共享能力只配一次
- 工具统一从桌面控制点路由
- 可复用的记忆与上下文被保留下来
- 结果不再依赖手工复制粘贴去回收

这也是为什么 LunaAgentOS 最终不想只做一个 session 查看器：它想减少 Agent 工作周围的额外负担，而不是再叠加一层新的负担。

## 当前能做什么

| 模块 | 状态 | 说明 |
|---|---:|---|
| LunaAgentOS App | 已可用 | 打开一个 Windows 优先的本地桌面工作台 |
| Claude Code | 已接入 | 把任务发进真实 Claude Code runtime session |
| Hermes | 已接入 | 使用 Windows / WSL ACP runtime instance 与 profile |
| OpenAI Codex Manifest | 已接入 | 通过 manifest 入口识别和承载 Codex agent |
| Runtime Session Card | 已可用 | 同屏查看 output、thought、runtime events 和 final response |
| Session Card 事件流 | 已可用 | 将 thought、tool、plan、usage、error 等过程信息整理成可展开的事件节点 |
| Focus 主视图 | 已可用 | 在工作区内聚焦单个 session，同时保持输入区可用 |
| Agent 原生命令入口 | 已可用 | 通过 slash command 发现并插入 runtime 暴露的原生命令 |
| Provider identity | 已可用 | 使用 provider icons 和 runtime identity 区分不同 agent entry |
| 多会话工作台 | 已可用 | 切换发送目标，保留 live sessions，查看 archived sessions |
| 本地历史 | 已可用 | 恢复 JSON session history，或打开只读归档 |
| 界面语言 | 已可用 | zh-CN / en-US 本地持久化切换 |

## 新版变化

- 执行过程更清楚：思考、工具调用、运行状态不再散落
- 单个会话更专注：进入 Focus 后，输入区仍然可用
- 多会话更好管：当前会话、历史会话、归档会话分区更明确
- Agent 身份更好认：不同供应商入口有更清楚的标识
- 常用命令更顺手：可以从输入区快速唤起 Agent 原生命令

## 下一阶段要做什么

下一阶段不再只是把多个 Agent 摆进同一个界面，而是让 LunaAgentOS 开始承担个人 Agent 工作的管理层。

现在的工作台已经能承载 Claude Code、Hermes 和 OpenAI Codex Manifest，也能展示过程、聚焦会话、区分历史和归档。接下来更重要的是：让这些入口、会话、账号、模型和资源变得可管理、可交接、可治理。

- **统一管理 Agent 资产**：把 provider、runtime、账号、API key、模型额度、订阅周期和试用状态放到一个地方，让用户知道哪些还能用、哪些快到期、哪些已经废弃。
- **减少无形浪费**：识别重复能力、闲置入口、过期配置和仍在消耗预算的 key，让用户不再靠记忆管理成本。
- **让工作可以跨 Agent 继续**：一个 Agent 的过程、上下文和结果，应该能在人的确认下交给另一个 Agent 继续，而不是靠手工复制粘贴。
- **让协作关系可见**：谁接过任务、谁正在执行、谁需要补充信息、谁产出最终结果，都应该在工作台里留下清楚的关系。
- **让入口健康状态更可信**：不仅显示 runtime 是否可用，还要解释配置缺口、错误状态、恢复路径和能力边界。
- **让工作台成为个人控制面**：从“选择一个 Agent 发送任务”，继续走向“管理我的 Agent 能力、预算、会话、历史和协作流”。

## 更长期的宏愿

长期看，LunaAgentOS 不该停在一个顺手的 desktop shell。

shell 只是第一层入口。真正要守住的是更深的工作秩序：在人和一组彼此不同的 Agent 产品之间，建立一个 **中立、可观察、可恢复、可治理的 Agent Desktop Environment**，再继续长成一个 **面向异构 Agent 产品的 operating layer**。

这个 operating layer 不靠把所有 runtime 改造成同一种内部模型来获得统一感。相反，它应该承认 Claude Code、Hermes、Trae 以及未来更多 Agent 产品都会保留自己的 runtime shape、权限边界、交互习惯和演化节奏。LunaAgentOS 要做的是在它们之上形成一个稳定的工作环境：

- 不同 runtime 可以被接入，而不需要被压扁成同一种内部结构
- runtime session 不只是一次请求记录，而是可以被观察、恢复、回放、审计和治理的工作对象
- entry 与 session 之间可以在明确的人类控制下进行任务路由，而不是由某个黑箱自动接管
- 多个 Agent 可以围绕同一段工作形成连续协作：一个 Agent 的过程、上下文和结果，可以在人的确认下成为另一个 Agent 继续工作的材料
- 审批、权限、过程证据和结果回收可以留在同一个可信位置
- 共享配置、工具、记忆、profile 和工作偏好不再碎裂在每一个 Agent 设置里
- 人可以在同一个桌面环境里理解“谁在做什么、为什么这样做、做到了哪里、还能不能接着做”

它更像一种新的工作环境：让 Agent 工作从分散的工具窗口、临时的上下文搬运和各家产品的怪脾气里解放出来，变得更可见、更可治理、更可持续，也更能被人类长期信任和掌控。

## 快速开始

### 环境要求

- Windows
- Node.js
- Rust + MSVC 工具链
- Tauri 2 相关依赖
- 如需 Claude 入口：本机可用的 Claude Code
- 如需 Hermes 入口：WSL + Hermes

Claude Code、Hermes 和 OpenAI Codex Manifest 是让工作台真正有价值的 runtime 入口。没有安装时，LunaAgentOS 也可以启动，对应入口会显示明确的配置状态，而不是崩溃或静默失败。

### 运行应用

```powershell
cd apps/desktop-shell
npm install
npm run tauri dev
```

### 构建轻量可执行文件

```powershell
cd apps/desktop-shell
npm run tauri build -- --no-bundle
```

可执行文件路径：

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

更详细的说明见：[快速开始](./docs/getting-started.zh-CN.md)

## 产品边界

LunaAgentOS 0.3.0 当前是：

- 真实 AI Agent 会话的中立桌面工作台
- 面向 Claude Code、Hermes 和 OpenAI Codex Manifest session 的 Windows 优先本地应用
- 以 Runtime Session Card、事件流和 Focus 主视图为中心的工作台
- 带有 Agent 原生命令入口和 provider identity 的 session workspace
- Human Command Workspace 的第一块可运行地基
- 由 protocol、adapters 和 Runtime Session Model 支撑的产品界面

LunaAgentOS 0.3.0 当前不是：

- 试图把外部 runtime 全部收编成单一内置 Agent 的产品
- 完整的多 Agent orchestration 平台
- 要把所有 Agent 内部机制强行做成一样
- Team Mode、远程入口或完整共享记忆总线
- 现在就去做插件市场或商业平台

## 文档入口

### 先看这些

- [文档总览](./docs/README.zh-CN.md)
- [0.3.0 发布说明](./docs/release-notes-0.3.zh-CN.md)
- [快速开始](./docs/getting-started.zh-CN.md)
- [当前产品边界](./docs/current-boundary.zh-CN.md)
- [贡献指南](./CONTRIBUTING.zh-CN.md)

### 产品与概念

- [产品定义（中文）](./docs/product-definition.zh-CN.md)
- [为什么做 LunaAgentOS（中文）](./docs/why-lunaagentos.zh-CN.md)
- [轻核心原则（中文）](./docs/light-core-principles.zh-CN.md)
- [路线图（中文）](./docs/roadmap.zh-CN.md)

### 架构与接入

- [架构概览](./docs/architecture-overview.zh-CN.md)
- [Hermes ACP Runtime](./docs/hermes-acp-profile-runtime.zh-CN.md)
- [Hermes TUI 方向](./docs/hermes-tui-direction.zh-CN.md)
- [Protocol](./protocol/README.md)（暂仅英文）
- [Adapters](./adapters/README.md)（暂仅英文）
- [Core](./core/README.md)（暂仅英文）
- [Apps](./apps/README.md)（暂仅英文）
- [Trae IDE Bridge](./bridges/trae-ide/README.md)（暂仅英文）

### 社区与政策

- [安全策略](./SECURITY.zh-CN.md)
- [商标与品牌使用说明](./TRADEMARKS.zh-CN.md)

### 英文入口

- [English README](./README.en.md)
- [English docs index](./docs/README.md)

## 作者

李白

## 社区

QQ群：687805974

## 许可证

本项目采用 [Apache-2.0](./LICENSE) 许可证。

## 贡献

当前最有价值的贡献方向：

- Claude Code / Hermes runtime 稳定性
- Runtime Session Card 的可用性和可读性
- Hermes thought / tool / plan / usage 事件体验
- 本地历史、恢复和错误态验证
- Trae IDE bridge 设计与接入
- 文档、截图和发布材料

开始前先看：[CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)
