<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">LunaAgentOS</h1>

<p align="center">
  <a href="./README.md">English</a>
</p>

**LunaAgentOS 0.1 Preview**

LunaAgentOS 是真实 AI Agent 会话的中立桌面工作台。

当前它是一个 Windows 优先的应用，已经能直接承载 Claude Code 和 Hermes：选择一个 runtime 入口，把真实任务发进 live session，实时看到 output、thought 和 runtime events，并从本地历史回到这段会话。

但这只是第一块能运行的切片。LunaAgentOS 想去的方向更大：它要成为一个 **Human Command Workspace**，让工作台去适应工作，而不是让人不断去适应围绕工作的各种工具。

**人类指挥。Agents 执行。工作台记住一切。**

![LunaAgentOS 桌面预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## 为什么做它

AI Agent 已经足够承担真实工作，但它们的会话仍然散落在不同工具里：

- CLI、TUI、IDE、gateway、SDK 各自只暴露工作的一部分
- thought、tool、plan、usage、output、final response 很少稳定地待在同一个可持续视图里
- 会话历史分散在工具孤岛中，恢复、对比和复盘比任务本身还麻烦
- 一旦进入多 Agent 工作，配置、记忆和工具能力就开始重复割裂

问题已经不只是 Agent 能力够不够，而是用户仍然要不断去适应围绕工作的各种工具表面。

LunaAgentOS 想把这个负担反过来：把你已有的 agents 带进来，保留它们各自的原生能力，同时给你一个统一的工作台，让你把注意力放回工作本身，而不是不断重新适应工具、搬运上下文和手工回收结果。

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

这种“呼吸感”不是一个小 UI 点子，而是产品哲学的一部分。

### 3. 中立的 Agent 桌面环境

LunaAgentOS 不应该把 Claude Code、Hermes、Trae 或未来更多 runtime 收编成一个内置超级 Agent。

它应该允许用户把自己已经信任的 agents 带进来，保持这些 agents 的可辨识性和原生能力，同时不再为每一次跨工具工作去重新适应一套新的表面。

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
| Trae IDE | Bridge 路线 | 预留 IDE-first adapter 方向 |
| Runtime Session Card | 已可用 | 同屏查看 output、thought、runtime events 和 final response |
| 多会话工作台 | 已可用 | 切换发送目标，保留 live sessions，查看 archived sessions |
| 本地历史 | 已可用 | 恢复 JSON session history，或打开只读归档 |
| 界面语言 | 已可用 | zh-CN / en-US 本地持久化切换 |

## 下一阶段要做什么

下一阶段不是突然跳到完整 orchestration 平台，而是把同一个工作台做得更可信：少让用户适应工具，多让工作台真正接住工作。

- 加强 Claude Code 和 Hermes runtime entry 的可靠性
- 让本地历史、恢复和归档 transcript 更值得信任
- 讲清 adapter 安装方式、能力边界，以及未来新 entry 的接入路径
- 继续加强 Trae IDE bridge 路线，但不把它伪装成已经成熟的主 runtime 路径
- 在真正实现之后，引入有针对性的 session handoff，让选中的上下文可以在 entry 或 session 之间流转
- 让工作台从“多段会话可见”进一步长成“更明确的人类指挥界面”

## 更长期的宏愿

如果 LunaAgentOS 做成，它不该只是一个好用的 desktop shell。

它应该成长为一个 **中立的 Agent Desktop Environment**，并继续往前长成一个 **面向异构 Agent 产品的 operating layer**：

- 不同 runtime 可以被接入，而不需要被压扁成同一种内部结构
- runtime session 可以被观察、恢复、回放和治理
- entry 与 session 之间可以在明确的人类控制下进行任务路由
- 审批、权限和结果回收可以留在同一个地方
- 共享配置、工具、记忆和 profile 不再碎裂在每一个 Agent 设置里

它最终不应该只是“又一个 AI app”。

它更像一个新的工作环境：让 Agent 工作变得比原始工具本身更可见、更可治理、更可持续，也更少受制于各个工具自己的怪脾气。

## 快速开始

### 环境要求

- Windows
- Node.js
- Rust + MSVC 工具链
- Tauri 2 相关依赖
- 如需 Claude 入口：本机可用的 Claude Code
- 如需 Hermes 入口：WSL + Hermes

Claude Code 和 Hermes 是让工作台真正有价值的 runtime 入口。没有安装时，LunaAgentOS 也可以启动，对应入口会显示明确的配置状态，而不是崩溃或静默失败。

### 运行应用

```powershell
cd apps/desktop-shell
npm install
npm run tauri -- dev
```

### 构建轻量可执行文件

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

可执行文件路径：

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

更详细的说明见：[快速开始](./docs/getting-started.zh-CN.md)

## 产品边界

LunaAgentOS 0.1 Preview 当前是：

- 真实 AI Agent 会话的中立桌面工作台
- 面向 Claude Code 和 Hermes session 的 Windows 优先本地应用
- 以 Runtime Session Card 为中心的工作台
- Human Command Workspace 的第一块可运行地基
- 由 protocol、adapters 和 Runtime Session Model 支撑的产品界面

LunaAgentOS 0.1 Preview 当前不是：

- 试图把外部 runtime 全部收编成单一内置 Agent 的产品
- 完整的多 Agent orchestration 平台
- 要把所有 Agent 内部机制强行做成一样
- 现在就去做插件市场或商业平台

## 文档入口

### 先看这些

- [文档总览](./docs/README.zh-CN.md)
- [0.1 Preview 发布说明](./docs/release-notes-0.1-preview.zh-CN.md)
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

- [English README](./README.md)
- [English docs index](./docs/README.md)

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
