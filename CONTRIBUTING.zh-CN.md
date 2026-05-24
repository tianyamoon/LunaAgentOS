# 贡献指南

[English](./CONTRIBUTING.md)

LunaAgentOS 是一个以协议为核心的异构 Coding Agent runtime 控制层。最有价值的贡献，是让当前 runtime 入口更可靠、让 Runtime Session 工作台更好用，或让 adapter contract 更清晰。

## 开始前

在提交 issue 或 pull request 之前，请先对齐这些项目边界：

1. LunaAgentOS 是外部 Agent 之上的控制层，不是替代外部 Agent 的底层 runtime。
2. Claude Code、Hermes 和 Runtime Session 工作台是当前可靠性重点。
3. runtime 特有行为应尽量留在 adapter 附近，除非协议需要抽象出共享概念。
4. 仓库仍在快速迭代，命名、文档和边界可能继续收敛。

## 搭建本地工作区

### 环境要求

- Windows
- Node.js
- Rust + MSVC 编译链
- Tauri 2 相关依赖

可选 runtime 依赖：

- Claude Code：如果你要验证 Claude 入口
- WSL 和 Hermes：如果你要验证 Hermes 入口

### 安装依赖

```powershell
cd apps/desktop-shell
npm install
```

### 运行桌面应用

```powershell
cd apps/desktop-shell
npm run tauri -- dev
```

### 构建轻量可执行文件

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

可执行文件通常位于：

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

## 验证你的改动

优先运行能覆盖改动的最小检查；如果改动跨越多个工作流，再运行更完整的检查。

### 完整检查

```powershell
cd apps/desktop-shell
npm run test:all
```

### 定向检查

```powershell
cd apps/desktop-shell
npm run test:runtime
npm run test:history
npm run test:providers
npm run test:markdown
npm run lint:undef
```

常用对应关系：

- runtime event 或 adapter surface 改动：`npm run test:runtime`
- 历史、恢复、归档或 payload 改动：`npm run test:history`
- provider 或 runtime target 状态改动：`npm run test:providers`
- Markdown 渲染或归一化改动：`npm run test:markdown`
- 跨 UI 或状态的改动：`npm run test:all`

如果你无法运行相关检查，请在 pull request 里说明原因。

## 当前高价值贡献方向

- Claude Code 和 Hermes runtime 稳定性
- Runtime Session Card 的可用性和可读性
- Hermes thought、tool、plan 和 usage 事件层级
- 本地历史、恢复、删除和错误态验证
- Trae IDE bridge 设计与接入
- Adapter contract 与 runtime surface 收敛
- 文档、截图、demo 和发布材料

## 项目判断

优先接受这类改动：

- 让协议决策保持显式
- 把 runtime 特有逻辑留在 adapter 边界
- 让工作台始终围绕 Runtime Session 组织
- 把外部入口当作真实产品，而不是装饰性外壳
- 让控制层保持轻量，并诚实面对当前范围

避免这类改动：

- 一次性急着接入大量 Agent
- 把协议决策埋进 app-only 代码
- 在控制层里重做 runtime 原生行为
- 在 contract 稳定前扩展到过宽的平台能力
- 增加当前实现无法支撑的产品宣称

## Issue

提交 issue 时，请包含：

- 涉及的入口：Claude Code / Hermes / Trae IDE / 其他
- 运行环境：Windows、WSL、相关 runtime 版本和重要配置
- 预期行为
- 实际行为
- 是否可以复现
- 有帮助的日志、截图或录屏，并移除其中的秘密信息

不要在公开 issue 中包含 secret、token、私有仓库数据或漏洞利用细节。安全敏感报告请遵循 [SECURITY.zh-CN.md](./SECURITY.zh-CN.md)。

## Pull Request

提交 pull request 前：

1. 让改动聚焦在一个问题上。
2. 如果行为、命令、公开路径或产品边界变化，请同步更新文档。
3. 运行相关验证命令。
4. 对可见 UI 改动，在有帮助时附上截图或录屏。
5. 新增公开文档时，在适用情况下遵循双语路径约定。

在 pull request 描述里，请说明：

- 这个改动解决什么问题
- 为什么这种方式适合 LunaAgentOS
- 影响哪些工作流或 runtime 入口
- 你运行了哪些验证
- 已知限制或后续工作

如果改动涉及协议、命名或产品边界，请明确写出判断，不要只列实现细节。

## 文档语言

公开文档使用以下约定：

- 英文主路径：`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`TRADEMARKS.md`、`docs/foo.md`
- 简体中文路径：`README.zh-CN.md`、`CONTRIBUTING.zh-CN.md`、`SECURITY.zh-CN.md`、`TRADEMARKS.zh-CN.md`、`docs/foo.zh-CN.md`
- `LICENSE` 保持唯一英文许可证文件。

新增或修改公开文档时，请保持英文和中文页面事实等价。可以自然翻译，但不能在不同语言里改变产品宣称。

## 法律与安全说明

- 代码采用 [Apache-2.0](./LICENSE) 许可。
- 商标和品牌使用说明见 [TRADEMARKS.zh-CN.md](./TRADEMARKS.zh-CN.md)。
- 安全敏感报告请遵循 [SECURITY.zh-CN.md](./SECURITY.zh-CN.md)。
