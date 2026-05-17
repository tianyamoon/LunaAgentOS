# LunaAgentOS 技术选型决策

## 目标

为 LunaAgentOS 选择一条适合长期演进的桌面产品技术路线。

这里讨论的不是“哪种语言我更熟”，而是：

1. 桌面启动方便
2. 交互体验好
3. 性能占用低
4. 跨平台
5. 普适性高
6. 尽量兼顾已有技术栈经验

## 当前结论

### 主推荐

- `Tauri 2 + Rust Core + 轻前端 UI`

### 保留备选

- `Avalonia + C#`

### 明确不作为主产品路线

- `Python GUI`
- `Electron` 作为长期主栈

## 为什么 Python 不适合作为最终主栈

Python 在当前仓库里有价值，但它的价值主要是：

- 协议 POC
- mock agent
- 验证脚本
- 回归测试 harness

它适合快速验证：

- `manifest`
- 生命周期状态机
- 统一消息格式
- `stdio_json / stdio_text` 适配

但它不适合作为 LunaAgentOS 的最终桌面产品主栈，因为我们最终要做的是：

- 多 Agent 控制台
- 多面板交互
- 进程编排
- 长期运行
- 高可观测性
- 低资源占用

## 候选技术栈对比

| 候选 | 桌面启动 | 交互表现 | 性能占用 | 跨平台 | 普适性 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `Tauri 2 + Rust` | 好 | 好 | 很好 | 好 | 很高 | 主推荐 |
| `Avalonia + C#` | 好 | 好 | 好 | 好 | 高 | 强备选 |
| `Electron` | 中 | 很好 | 一般偏重 | 好 | 很高 | 不优先 |
| `Python GUI` | 中 | 一般 | 一般 | 中 | 中 | 不作为主产品栈 |
| `JavaFX` | 中 | 中 | 中 | 好 | 中 | 可行但不优先 |

## 为什么主推荐是 Tauri 2 + Rust

### 1. 更符合“Agent 已经很吃资源”的现实

LunaAgentOS 不是单机工具，它外面还会挂多个 Agent 进程。

所以桌面壳本身必须尽量轻，不能像一个完整浏览器一样占掉大量内存和 CPU。

Tauri 在这一点上的综合平衡更好，适合做“控制层很轻，底层 Agent 很重”的产品。

### 2. UI 表达力强

LunaAgentOS 未来一定不是一个朴素表单应用，而是要支持：

- 多窗口 / 多面板
- 呼吸感状态流
- 工具调用面板
- 历史流与归档
- 任务卡片
- 人类工作台

这类界面用现代 UI 技术做表达会更灵活。

### 3. Rust 适合作为 Core

Rust 很适合承接 LunaAgentOS 最核心的系统能力：

- 子进程管理
- PTY / stdio
- 插件协议执行
- 状态机
- 事件总线
- 路由与资源控制

也就是说：

- UI 可以灵活演进
- 内核保持稳定、轻量、跨平台

## 为什么 Avalonia + C# 是强备选

Avalonia 的优势非常明确：

- 纯桌面范式
- 跨平台
- C# 生态成熟
- 不依赖浏览器式 UI 容器

如果后面出现以下情况，Avalonia 可以升为主路线：

1. 我们越来越确认“不想要 Web UI 作为桌面表达层”
2. 需要更强的纯桌面操作手感
3. 团队更倾向于 C# 主体工程

所以 Avalonia 不是淘汰项，而是明确保留的 B 方案。

## 为什么 Electron 不作为长期首选

Electron 的问题不是不能做，而是它对 LunaAgentOS 来说偏重。

如果产品本身已经要调度多个 Agent 进程，那么主程序再背一整套更重的桌面容器，长期体验和资源占用会吃亏。

它适合：

- 快速原型
- 前端主导团队
- 极致追求生态便利

但不适合作为当前 LunaAgentOS 的长期第一推荐。

## 推荐的架构分层

### 1. Core

建议由 `Rust` 承担：

- Adapter Runtime
- Manifest Loader
- Log Scrubber
- State Inferer
- Process Manager
- Event Bus
- Plugin Host

### 2. Desktop Shell

建议由 `Tauri 2` 承担：

- 应用窗口
- 系统集成
- 桌面生命周期
- 与 Core 的桥接

### 3. UI Layer

建议保持轻量：

- 多 Agent 面板
- 状态流
- 工具调用视图
- 审批与任务分发
- 历史/归档

### 4. Verification Layer

当前保留 `Python`：

- mock agent
- 适配器协议回归测试
- 小规模实验验证

## 这对当前仓库意味着什么

### 当前 Python 代码的定位

当前这些文件依然有价值：

- `adapter.py`
- `mock_agent.py`
- `test_runner.py`

但它们的角色应该被重新定义为：

- 协议原型
- 行为样本
- 回归验证工具

而不是未来主产品的直接代码基础。

### 当前工程目标的调整

从现在开始，仓库里的工程决策应尽量朝这个方向收口：

1. 协议保持语言无关
2. Core 设计逐步向 Rust 可迁移结构靠拢
3. UI 不再假设必须由 Python 承担

## 决策摘要

### 正式口径

LunaAgentOS 当前推荐的长期主技术路线为：

- `Tauri 2 + Rust Core + 轻前端 UI`

同时保留：

- `Avalonia + C#` 作为高质量纯桌面备选方案

### 当前执行原则

1. Python 继续用于协议验证，不再被视为最终产品主栈
2. 后续文档和架构设计，按“Rust Core + Desktop Shell”思路展开
3. 技术栈偏好不是第一约束，但在同等条件下，保留对 C# 方案的兼容思考
