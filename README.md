# LunaAgentOS

[中文说明](./README_CN.md) | English Summary

## 中文

LunaAgentOS 是一个面向多 Agent 编排的通用控制台项目。

它的目标不是重新发明底层 Agent，而是在现有 Agent CLI / IDE / Gateway 之上建立统一的控制层，让不同运行时可以被统一接入、观测、调度和归档。

### 当前阶段

当前仓库处于 `Phase 0 - CLI Agent Adapter POC`：

- 定义统一的 `manifest`、生命周期状态机和消息格式
- 验证 `stdio_json` / `stdio_text` 两类 CLI 接入路径
- 为后续多 Agent 控制台与控制平面打底

### 当前已落地内容

- `adapter.py`
  - 基于 `asyncio` 的 `StdioAgentAdapter`
  - 内置 `Log Scrubber` 和 `State Inferer`
- `mock_agent.py`
  - 带脏日志噪音的模拟 CLI Agent
- `test_runner.py`
  - 端到端验证 `INIT -> THINK -> TOOLING -> RESP -> DONE`
- `plugins/mock/manifest.json`
  - mock 插件清单
- `plugins/claude-code/manifest.example.json`
  - 强大样板示例
- `plugins/hermes/manifest.example.json`
  - 通用样板示例
- `bridges/trae-ide/README.md`
  - 免费样板的桥接说明
- `docs/validation-report.md`
  - 本地验证结果
- `docs/target-matrix.md`
  - `强大 / 通用 / 免费` 目标矩阵
- `docs/tech-stack-decision.md`
  - 当前技术选型决策（主推荐 `Tauri 2 + Rust`，保留 `Avalonia + C#`）
- `docs/mvp-v1-scope.md`
  - 第一版最小需求路径
- `docs/mvp-v1-interaction-model.md`
  - 第一版主交互模型与主 agent 多会话机制
- `docs/architecture-overview.md`
  - 架构总览
- `docs/why-lunaagentos.md`
  - 为什么做这个项目
- `docs/open-questions.md`
  - 当前开放问题
- `docs/competitive-positioning.md`
  - amux / Goose / Fusion 的竞争定位与我们的生存空间
- `docs/light-core-principles.md`
  - 第一版必须坚持的轻核心原则
- `docs/desktop-shell-validation.md`
  - 桌面壳验证记录
- `CONTRIBUTING.md`
  - 贡献指南
- `prototype/console/`
  - 最小控制台原型，可直接承接未来桌面壳

### 样板策略

LunaAgentOS 的首批样板不是按“谁最像”来选，而是按“谁最有代表性”来选：

- `Claude Code`：强大
- `Hermes`：通用
- `Trae IDE`：免费

其中：

- `Claude Code` 与 `Hermes` 属于当前 CLI Adapter POC 的直接目标
- `Trae IDE` 属于产品优先级很高、但技术上需要桥接方案的目标

### 本地验证

使用工作区自带 Python 可运行：

```powershell
C:\Users\tiany\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe test_runner.py
```

预期看到：

```text
INIT -> THINK -> TOOLING -> RESP -> DONE
```

### 控制台原型

第一版已经开始落最小控制台原型：

- 左侧 Agent 舰队
- 中间任务与消息流
- 右侧状态时间线
- 底部人类输入入口

原型文件位于 `prototype/console/`，用于承接未来桌面壳实现。

### 桌面壳进展

当前已经初始化真实 `Tauri 2` 桌面工程，并将控制台原型接入：

- `desktop-shell/`

当前可验证产物：

- `desktop-shell/src-tauri/target/release/desktop-shell.exe`

### 国际化说明

仓库从一开始就按中英文双本地化组织：

- `README.md`：仓库入口，中文优先并附英文摘要
- `README_CN.md`：完整中文文档

后续推送远端前，可继续扩展完整英文版说明。

## English Summary

LunaAgentOS is a universal control plane project for orchestrating multiple agent runtimes.

Instead of replacing existing agents, it aims to build a unified control layer above existing CLI, IDE, and gateway-based agent products.

Current phase:

- `Phase 0 - CLI Agent Adapter POC`
- validate `stdio_json` and `stdio_text`
- prove the manifest, lifecycle state machine, and unified message schema

Current target wedge:

- `Claude Code` = strongest sample
- `Hermes` = general sample
- `Trae IDE` = free sample

Current local validation:

- mock adapter flow passes
- expected state path: `INIT -> THINK -> TOOLING -> RESP -> DONE`

For full Chinese documentation, see [README_CN.md](./README_CN.md).
