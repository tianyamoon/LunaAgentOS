# LunaAgentOS

LunaAgentOS 是一个面向异构 Coding Agent 的桌面控制台。

它不是另一个底层 Agent，也不是 Claude Code 的桌面套壳。它站在 Claude Code、Hermes、未来的 IDE Agent 之上，提供统一入口、会话工作台、过程可见性和本地历史。

![LunaAgentOS Stage 1 中文预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## 一句话定位

> LunaAgentOS 是异构 Agent 之上的统一 Runtime Session 工作台。

当前第一版先解决一个最小但重要的问题：

- 用户不再在多个 Agent 入口之间来回跳。
- 左侧选择当前发送目标。
- 中间用会话卡片承载真实 runtime 的输出、思考流、运行流和最终响应。
- 右侧沉淀本地 JSON 会话历史，并区分活会话与归档会话。

## 为什么值得做

现在的 Agent 产品越来越强，但也越来越碎：

- **入口不同**：CLI、TUI、IDE、网关型 Agent 都在并行出现。
- **过程可见性不同**：有的能看到 thought/tool/plan/usage，有的只给最终响应。
- **历史割裂**：不同工具里的会话难以统一归档、恢复、对比和复盘。
- **人类工作台缺位**：用户缺少一个中立的地方来调度、观察和沉淀多个 Agent。

LunaAgentOS 的方向不是重写这些 Agent，而是把它们收拢到一个更高层的控制台里。

## 当前阶段：Stage 1

`Stage 1` 是内部推进阶段，含义是 **最小异构桌面控制台雏形**。

这个阶段不做复杂编排，不做插件市场，也不包装成最终 Agent OS。它先证明：

- `Claude Code` 真实可用。
- `Hermes` 通过 Windows / WSL / ACP runtime instance 真实可用。
- 两者能出现在同一个桌面工作台。
- 会话卡片能承载输出、思考流、运行流和最终响应。
- 会话结果能沉淀到本地历史。
- 启动时会按 provider / runtime instance 探测本机 runtime，即使用户还没安装 Claude Code 或 Hermes，桌面壳也能正常打开。
- 顶部提供中文 / English 界面切换，并覆盖左侧入口、会话卡片、右侧历史、代码块和报表视图等动态标签。

如果只有 Claude，不算最小异构控制台成立；只有 Claude + Hermes 都进入工作台，Stage 1 才站得住。

## 当前能力状态

| 模块 | 状态 | 说明 |
|---|---:|---|
| 桌面壳 | 已可用 | Tauri 2 + Rust Core + 前端工作台，密集面板滚动条已弱化 |
| Claude Code | 已接入 | 真实 runtime 路径 |
| Hermes | 已接入 | Windows / WSL / ACP runtime instance 与 profile |
| Trae IDE | 规划中 | 保留 Bridge 路线，不伪装已接入 |
| 多会话工作台 | 已可用 | 当前发送目标、当前会话、活会话集合分离 |
| Runtime Session Card | 已可用 | 输出流、思考流、运行流、最终响应 |
| 本地历史 | 已可用 | JSON 历史、只读恢复、删除保护 |
| 演示 / 截图模式 | 已可用 | 顶部 `演示场景` 按钮加载非持久化 demo |
| Runtime 检测 | 已可用 | 启动探测区分 provider、runtime instance、发送目标/profile |
| 界面语言 | 已可用 | zh-CN / en-US 本地持久化切换，覆盖静态与动态工作台标签 |

## 快速开始

### 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 相关依赖
- 如需 Claude 入口：本机可用的 Claude Code
- 如需 Hermes 入口：WSL + Hermes

Claude Code 和 Hermes 是外部 runtime，不是 LunaAgentOS 启动前置条件。未安装或路径不同的机器上，入口会显示为 `未配置` 或 `不可用`，用户可以先打开工作台，再按本机环境配置。

### 连接与 runtime 检测

在左侧 Agent 舰队点击 **连接详情**，可以查看并重新检查本机 runtime 可用性。

左侧结构现在按 provider -> runtime instance -> target/profile 展示：

- Claude Code 可以同时显示 Windows 与 WSL runtime instance。
- Hermes 可以同时显示 Windows 与 WSL runtime instance。
- Hermes profile 会挂在实际探测到它的 runtime instance 下。
- 如果某台机器没有可用 runtime，入口仍保留，并显示清晰的未连接状态。

旧版 prompt 配置入口保留在连接详情弹窗中，作为 fallback。

配置会保存到应用本地目录的 `runtime-config.json`，不会写入仓库。

### 启动开发模式

```powershell
cd desktop-shell
npm install
npm run tauri -- dev
```

### 构建轻量 release 可执行文件

```powershell
cd desktop-shell
npm run tauri -- build --no-bundle
```

当前已验证产物路径：

```text
desktop-shell/src-tauri/target/release/desktop-shell.exe
```

更详细的启动说明见：

- [docs/getting-started.md](./docs/getting-started.md)
- [desktop-shell/README.md](./desktop-shell/README.md)

## 演示 / 截图模式

为了 GitHub 首发，桌面壳提供了一个受控演示场景。

打开应用后点击顶部 **演示场景**，会加载一组非持久化 demo 数据：

- Claude Code 与 Hermes 同时出现在中间工作台。
- Hermes 卡片展示 thought/tool/usage/session update 等过程感。
- Claude 卡片展示 Markdown 表格与代码块阅读效果。
- 右侧会话列表展示 `活会话` 与 `归档会话` 两个生命周期分组。

这个模式只用于截图和演示，不写入真实 runtime 历史。

## 产品边界

LunaAgentOS 当前是：

- **外部 Agent 之上的控制层**
- **Runtime Session Card 工作台**
- **异构入口的中立桌面控制台**
- **走向调用流、协作流和控制平面的第一步**

LunaAgentOS 当前不是：

- Claude Code 的桌面壳
- 又一个聊天器
- 伪造多 Agent 的内部角色系统
- 已经完成的商业平台
- Stage 2 编排系统

## 三个首批入口

### Claude Code

代表能力上限和高价值 coding workflow。

### Hermes

代表通用入口、WSL / ACP 验证，以及“让慢变得可见”的过程可见方向。

### Trae IDE

代表免费入口和 IDE Bridge 方向。当前只作为桥接目标保留，不伪装成已经原生接入。

## 文档入口

- [docs/README.md](./docs/README.md)：文档总入口
- [docs/getting-started.md](./docs/getting-started.md)：快速开始
- [docs/why-lunaagentos.md](./docs/why-lunaagentos.md)：为什么做
- [docs/architecture-overview.md](./docs/architecture-overview.md)：架构总览
- [docs/prompt-v1-alignment.md](./docs/prompt-v1-alignment.md)：Stage 1 边界
- [docs/hermes-acp-profile-runtime.md](./docs/hermes-acp-profile-runtime.md)：Hermes ACP 接入说明
- [docs/hermes-tui-direction.md](./docs/hermes-tui-direction.md)：Hermes 过程可见方向
- [bridges/trae-ide/README.md](./bridges/trae-ide/README.md)：Trae IDE Bridge

## 下一步

- 继续打磨 Runtime Session Card，让它同时适配 Claude Code 的长 Markdown / 代码输出与 Hermes 的 TUI 式过程事件。
- 继续增强 Hermes 会话恢复、错误态和事件去噪。
- 形成 Trae IDE Bridge 的真实技术路径。
- 在 Stage 1 稳定后，再进入 Stage 2 调用流。

## 贡献

当前最需要帮助的方向：

- Claude Code / Hermes runtime 稳定性
- Hermes thought/tool/plan/usage 事件 UI
- Runtime Session Card 视觉与可用性
- Trae IDE Bridge 调研
- 文档、截图、验证报告

请先阅读：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
