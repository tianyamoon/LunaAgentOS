# LunaAgentOS

## 项目定位

LunaAgentOS 是一个“通用 Agent 控制台 / 控制平面”项目。

它不试图替代 Claude、Hermes、Trae 这类现成 Agent 产品，而是希望在它们之上建立一层统一的控制能力：

- 统一接入
- 统一状态机
- 统一消息格式
- 统一观测与归档
- 统一的人类审批与任务分发

一句话说，它做的是 **现成 Agent 之上的控制层**，而不是新的底层 Agent Runtime。

## 为什么做

当前主流 Agent 产品正在快速分化：

- 有的强在 CLI
- 有的强在 IDE
- 有的强在 Gateway / 长连接服务

但对于用户来说，真正的痛点不是“找不到 Agent”，而是：

- 多个 Agent 无法统一编排
- 思考流与工具调用不可见
- 会话难以归档、搜索和回放
- 人类工作流缺少审批、注入与调度入口

LunaAgentOS 的目标，就是把这些异构 Agent 收拢进一个统一的控制台/控制平面。

## 当前阶段：Phase 0 - CLI Agent Adapter POC

当前仓库首先验证一件事：

**不同风格的 CLI 输出，能不能被收敛成一套统一事件流。**

这一阶段关注的是协议与适配，而不是完整 GUI。

### 当前协议要点

- `Manifest`
  - 定义插件身份、传输方式、启动命令、是否需要 PTY
- 生命周期状态机
  - `INIT / IDLE / THINK / TOOLING / RESP / DONE / ERROR`
- 统一消息格式
  - 上行事件标准化输出
  - 下行命令统一注入

### 当前重点传输

- `stdio_json`
- `stdio_text`

## 当前仓库内容

### 核心代码

- `adapter.py`
  - `StdioAgentAdapter`
  - `Manifest` 解析
  - `Log Scrubber`
  - `State Inferer`
  - 启停与优雅退出

- `mock_agent.py`
  - 模拟 CLI Agent
  - 故意输出非 JSON 噪音
  - 模拟思考、工具调用、最终回复与完成态

- `test_runner.py`
  - 加载 mock manifest
  - 发送 prompt
  - 监听标准化事件
  - 验证完整状态流

### 插件与桥接说明

- `plugins/mock/manifest.json`
  - 可运行的 mock manifest
- `plugins/claude-code/manifest.example.json`
  - `强大` 样板的示例 manifest
- `plugins/hermes/manifest.example.json`
  - `通用` 样板的示例 manifest
- `bridges/trae-ide/README.md`
  - `免费` 样板的桥接说明

### 说明文档

- `docs/validation-report.md`
  - 本地协议验证结果
- `docs/target-matrix.md`
  - 首批三家样板矩阵
- `docs/tech-stack-decision.md`
  - 技术选型决策文档
- `docs/mvp-v1-scope.md`
  - 第一版最小需求路径
- `docs/architecture-overview.md`
  - 架构总览
- `docs/why-lunaagentos.md`
  - 项目动机
- `docs/open-questions.md`
  - 当前开放问题
- `CONTRIBUTING.md`
  - 贡献指南
- `prototype/console/`
  - 最小控制台原型

## 首批三家样板

这个项目当前不是简单按“谁好接”来选目标，而是按“谁最能代表一类价值”来选样板：

- `Claude Code`：强大
- `Hermes`：通用
- `Trae IDE`：免费

### 1. Claude Code

代表“能力上限”和高价值付费用户。

它的重要性在于：如果 LunaAgentOS 能稳定接住 Claude Code，产品立刻具备高端用户相关性。

### 2. Hermes

代表“最适合率先跑通真实接入”的通用样板。

它的重要性在于：更适合作为首个现实 Adapter，帮助验证协议、状态机和事件流设计。

### 3. Trae IDE

代表“免费入口”。

它的重要性不在于它像 CLI，而在于它自带免费模型和工具体验，具备拉新和扩大影响力的潜力。

但这里要保持技术诚实：

- `Trae IDE` 是产品上必须纳入的首批样板
- 它不是当前 `stdio` POC 中的天然原生目标
- 它更适合作为后续 `IDE Bridge / Desktop Bridge` 方向单独推进

## 当前验证结果

当前本地已经完成 mock 链路验证。

### 运行命令

```powershell
C:\Users\tiany\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe test_runner.py
```

### 验证结果

```text
INIT -> THINK -> TOOLING -> RESP -> DONE
```

这说明当前 POC 已经验证了：

- manifest 加载
- 子进程启动
- prompt 注入
- 脏日志过滤
- JSON 提取
- 状态推断
- tool request / tool result 回注
- 最终完成态收敛

## 当前原型实现

除了协议 POC，仓库中已经开始落第一版“最小控制台原型”：

- 左侧 Agent 列表
- 中间任务卡与消息流
- 工具调用面板
- 右侧状态时间线
- 底部人类输入入口

原型目录：

- `prototype/console/`

这套原型的目标不是替代最终桌面产品，而是提前把“控制台长什么样、最小交互闭环长什么样”做成可见资产，方便吸引参与者和承接未来桌面壳。

## 国际化与本地化策略

仓库从一开始就按中英文双语来组织。

### 当前文件

- `README.md`
  - 仓库入口
  - 中文优先 + 英文摘要
- `README_CN.md`
  - 完整中文说明

### 后续建议

推送远端前可再补一版完整英文说明，形成：

- `README.md`：国际访客入口页
- `README_CN.md`：完整中文文档

这样既满足中文优先，也兼顾国际传播。

## 下一步

1. 用当前 adapter 对接第一个真实目标，优先 `Hermes`
2. 再接 `Claude Code`，验证高价值样板
3. 并行定义 `Trae IDE` 的桥接策略，而不是伪装成 CLI manifest
4. 在协议稳定后，继续向控制台 / 控制平面演进
