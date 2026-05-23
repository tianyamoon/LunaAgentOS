# LunaAgentOS

LunaAgentOS 是一个以协议为核心的异构 Coding Agent 操作层。

它以统一 JSON Contract、Runtime Adapter / Plugin Contract 和 Runtime Session Model 为基础。LunaAgentOS App 是协议的具象化控制台，也是官方推荐使用方式：选择目标、把任务送入真实 runtime、观察过程，并沉淀本地历史。

![LunaAgentOS 桌面预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## 远景

Agent 会越来越强，也会越来越分散：

- **入口分散**：CLI、TUI、IDE、Gateway、SDK 都会长期并存。
- **过程可见性不一致**：有的 runtime 能看到 thought/tool/plan/usage，有的只给最终响应。
- **历史割裂**：不同工具里的会话很难统一归档、恢复、对比和复盘。

LunaAgentOS 要做的是这些 Agent 之上的协议与控制层：

> 把每个外部 Agent 当作 runtime entry，把会话卡片做成统一承载输出流、思考流、运行流、最终响应和本地历史的 Runtime Session Surface。

长期方向是 adapter-driven operating layer：Protocol 和 Adapter 定义运行契约，Runtime Session Model 承载工作过程，App 把这套契约变成可使用的产品体验。

## 当前能力

| 模块 | 状态 | 说明 |
|---|---:|---|
| 产品定义 | 已明确 | Protocol / Adapter Contract / Runtime Session Model |
| LunaAgentOS App | 已可用 | Tauri 2 + Rust Core + 前端工作台 |
| Claude Code | 已接入 | 真实 runtime 入口 |
| Hermes | 已接入 | Windows / WSL ACP runtime instance 与 profile |
| Trae IDE | Bridge | IDE-first Adapter 路线 |
| Runtime Session Card | 已可用 | 输出流、思考流、运行流、最终响应 |
| 多会话工作台 | 已可用 | 当前发送目标、当前会话、活会话、归档会话和一致生命周期色彩 |
| 本地历史 | 已可用 | JSON 历史、恢复、只读归档和错误态 |
| 演示模式 | 已可用 | 顶部 `演示场景` 加载非持久化 demo |
| Runtime 检测 | 已可用 | 区分 provider、runtime instance、target/profile |
| 界面语言 | 已可用 | zh-CN / en-US 本地持久化切换 |

## 快速开始

### 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 相关依赖
- 如需 Claude 入口：本机可用的 Claude Code
- 如需 Hermes 入口：WSL + Hermes

Claude Code 和 Hermes 是可选外部 runtime。未安装或路径不同的机器上，入口会显示为 `未配置` 或 `不可用`。

### 运行 LunaAgentOS App

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

更详细的启动说明见：

- [docs/getting-started.md](./docs/getting-started.md)
- [apps/desktop-shell/README.md](./apps/desktop-shell/README.md)

## 演示模式

打开应用后点击顶部 **演示场景**，会加载一组非持久化 demo 数据：

- Claude Code 与 Hermes 同时出现在中间工作台。
- Hermes 卡片展示 thought/tool/usage/session update 等过程感。
- Claude 卡片展示 Markdown 表格与代码块阅读效果。
- 右侧会话列表展示 `活会话` 与 `归档会话` 两个生命周期分组。

这个模式只用于截图和理解产品形态，不写入真实 runtime 历史。

## 产品边界

LunaAgentOS 当前是：

- **外部 Agent 之上的控制层**
- **异构 runtime entry 的协议与 Adapter Contract**
- **Runtime Session Card 工作台**
- **协议的具象化控制台**
- **走向调用流、协作工作台和控制平面的起点**

App 是当前官方推荐使用方式。新增 Agent 产品通过 Adapter Contract 接入，让产品体验保持一致，同时保留每个 runtime 的原生强项。

## 三个首批入口

### Claude Code

代表高价值 coding workflow。

### Hermes

代表 WSL / ACP 接入验证，以及“让慢变得可见”的过程可见方向。

### Trae IDE

代表 IDE-first Agent 产品的 Bridge 接入路线。

## 文档入口

- [docs/README.md](./docs/README.md)：文档总入口
- [docs/product-definition.md](./docs/product-definition.md)：产品定义、协议与 Adapter 方向
- [docs/getting-started.md](./docs/getting-started.md)：快速开始
- [docs/current-boundary.md](./docs/current-boundary.md)：当前产品边界
- [docs/why-lunaagentos.md](./docs/why-lunaagentos.md)：为什么做
- [docs/architecture-overview.md](./docs/architecture-overview.md)：架构总览
- [docs/roadmap.md](./docs/roadmap.md)：路线图
- [protocol/README.md](./protocol/README.md)：协议契约
- [adapters/README.md](./adapters/README.md)：Adapter 入口
- [apps/README.md](./apps/README.md)：App 入口
- [docs/hermes-acp-profile-runtime.md](./docs/hermes-acp-profile-runtime.md)：Hermes ACP 接入说明
- [docs/hermes-tui-direction.md](./docs/hermes-tui-direction.md)：Hermes 过程可见方向
- [bridges/trae-ide/README.md](./bridges/trae-ide/README.md)：Trae IDE Bridge

## 贡献

当前最需要帮助的方向：

- Claude Code / Hermes runtime 稳定性
- Hermes thought/tool/plan/usage 事件 UI
- Runtime Session Card 视觉与可用性
- 本地历史、恢复和错误态验证
- Trae IDE Bridge 设计与接入
- 文档、截图和发布材料

请先阅读：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
