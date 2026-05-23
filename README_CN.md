# LunaAgentOS

LunaAgentOS 是一个面向异构 Coding Agent 的桌面控制台。

它不是另一个底层 Agent，也不是 Claude Code 的桌面套壳。它站在 Claude Code、Hermes、未来的 IDE Agent 之上，提供统一入口、Runtime Session 工作台、过程可见性和本地历史。

![LunaAgentOS 桌面预览图](./docs/assets/lunaagentos-stage1-preview-cn.svg)

## 远景

Agent 会越来越强，也会越来越分散：

- **入口分散**：CLI、TUI、IDE、Gateway、SDK 都会长期并存。
- **过程可见性不一致**：有的 runtime 能看到 thought/tool/plan/usage，有的只给最终响应。
- **历史割裂**：不同工具里的会话很难统一归档、恢复、对比和复盘。

LunaAgentOS 要做的是这些 Agent 之上的控制层：

> 把每个外部 Agent 当作 runtime entry，把会话卡片做成统一承载输出流、思考流、运行流、最终响应和本地历史的 Runtime Session Surface。

当前先做轻量桌面工作台，下一步走向调用流、协作工作台和更完整的控制平面。

## 当前能力

| 模块 | 状态 | 说明 |
|---|---:|---|
| 桌面壳 | 已可用 | Tauri 2 + Rust Core + 前端工作台 |
| Claude Code | 已接入 | 真实 runtime 入口 |
| Hermes | 已接入 | Windows / WSL ACP runtime instance 与 profile |
| Trae IDE | 规划中 | 保留 Bridge 路线，不伪装已接入 |
| Runtime Session Card | 已可用 | 输出流、思考流、运行流、最终响应 |
| 多会话工作台 | 已可用 | 当前发送目标、当前会话、活会话、归档会话 |
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

Claude Code 和 Hermes 是外部 runtime，不是 LunaAgentOS 启动前置条件。未安装或路径不同的机器上，入口会显示为 `未配置` 或 `不可用`。

### 运行桌面壳

```powershell
cd desktop-shell
npm install
npm run tauri -- dev
```

### 构建轻量可执行文件

```powershell
cd desktop-shell
npm run tauri -- build --no-bundle
```

可执行文件路径：

```text
desktop-shell/src-tauri/target/release/desktop-shell.exe
```

更详细的启动说明见：

- [docs/getting-started.md](./docs/getting-started.md)
- [desktop-shell/README.md](./desktop-shell/README.md)

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
- **Runtime Session Card 工作台**
- **异构入口的中立桌面控制台**
- **走向调用流、协作工作台和控制平面的起点**

LunaAgentOS 当前不是：

- Claude Code 的桌面壳
- 又一个聊天器
- 伪造多 Agent 的内部角色系统
- 已完成的商业平台
- 完整编排系统

## 三个首批入口

### Claude Code

代表高价值 coding workflow。

### Hermes

代表 WSL / ACP 接入验证，以及“让慢变得可见”的过程可见方向。

### Trae IDE

代表 IDE Bridge 方向。当前只作为桥接目标保留，不伪装成已经原生接入。

## 文档入口

- [docs/README.md](./docs/README.md)：文档总入口
- [docs/getting-started.md](./docs/getting-started.md)：快速开始
- [docs/current-boundary.md](./docs/current-boundary.md)：当前产品边界
- [docs/why-lunaagentos.md](./docs/why-lunaagentos.md)：为什么做
- [docs/architecture-overview.md](./docs/architecture-overview.md)：架构总览
- [docs/roadmap.md](./docs/roadmap.md)：路线图
- [docs/hermes-acp-profile-runtime.md](./docs/hermes-acp-profile-runtime.md)：Hermes ACP 接入说明
- [docs/hermes-tui-direction.md](./docs/hermes-tui-direction.md)：Hermes 过程可见方向
- [bridges/trae-ide/README.md](./bridges/trae-ide/README.md)：Trae IDE Bridge

## 贡献

当前最需要帮助的方向：

- Claude Code / Hermes runtime 稳定性
- Hermes thought/tool/plan/usage 事件 UI
- Runtime Session Card 视觉与可用性
- 本地历史、恢复和错误态验证
- Trae IDE Bridge 调研
- 文档、截图和首发材料

请先阅读：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
