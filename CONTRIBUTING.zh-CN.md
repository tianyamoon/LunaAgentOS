# 贡献指南

LunaAgentOS 正在建设一个以协议为核心的异构 Coding Agent 控制层。当前最重要的工作，是让现有 runtime 接入稳定可信，让 Runtime Session 工作台足够好用，并把 adapter contract 逐步做实。

## 开始前先确认

在着手实现前，请先确认这三个前提：

1. 你理解 LunaAgentOS 是外部 Agent 之上的控制层，不是另一个底层 Agent。
2. 你认可当前阶段优先稳定 Claude Code、Hermes 和 Runtime Session workspace。
3. 你接受项目现在仍在快速迭代，文档、命名和边界会继续收敛。

## 本地开发

### 基础要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 相关依赖

可选 runtime：

- Claude Code：用于验证 Claude entry
- WSL + Hermes：用于验证 Hermes entry

### 启动应用

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

### 运行测试

```powershell
cd apps/desktop-shell
npm run test:all
```

常用的定向检查：

- `npm run test:runtime`
- `npm run test:history`
- `npm run test:providers`
- `npm run test:markdown`
- `npm run lint:undef`

如果你的改动影响某个明确模块，请至少运行对应测试；如果改动跨越多个工作流，优先补跑 `npm run test:all`。

## 当前最欢迎的贡献

- Claude Code / Hermes runtime 稳定性
- Runtime Session Card 的可用性与可读性
- Hermes thought / tool / plan / usage 事件层级
- 本地历史、恢复、删除、错误态验证
- Trae IDE Bridge 设计与接入
- Runtime surface / adapter contract 收敛
- 文档、截图、demo 和发布材料

## 改动时的项目判断

### 优先保持什么

- **协议优先**：新增 runtime 能力尽量先落到 contract，而不是只写死在某个界面里。
- **adapter 边界清晰**：runtime 特有逻辑尽量留在 adapter 一侧。
- **Runtime Session 优先**：中间工作台始终围绕 session card 组织。
- **真实入口优先**：Claude Code、Hermes、Trae IDE 都被视为真实外部入口，而不是 UI 装饰。
- **轻核心**：控制层保持聚焦，不抢底层 runtime 已经做得好的事情。

### 当前不要急着做什么

- 一次性接入大量 Agent
- 过早抽象商业化能力
- 在控制层里重做 runtime 原生体验
- 跳过 contract 直接堆特例逻辑

## 提交建议

### Issue

提问题或提需求时，尽量说清楚：

- 你使用的入口：Claude Code / Hermes / Trae IDE
- 运行环境：Windows、WSL、相关版本信息
- 你期待的行为
- 实际发生了什么
- 是否能稳定复现

### Pull Request

PR 最有帮助的内容是：

- 改动解决了什么问题
- 为什么这样改
- 影响了哪些入口或工作流
- 你跑过哪些验证命令
- 如果是 UI 改动，附上截图或录屏

如果改动涉及协议、命名或边界，请在描述里把判断讲清楚，不要只贴实现细节。

## 文档语言

项目目前同时维护中英文入口：

- 根 README 提供中英文双入口
- 英文文档优先承担公开介绍和对外扫描
- 中文文档优先承载更完整的背景、解释和推进判断

如果你新增关键文档，优先保证至少有一种语言版本完整可读；如果它会出现在 GitHub 首页或 docs 首页，请尽量补齐对应语言入口。
