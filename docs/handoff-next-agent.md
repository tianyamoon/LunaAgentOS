# LunaAgentOS 交接说明（给下一个 Agent）

## 1. 当前项目位置

- Repo：`F:\codes\LunaAgentOS`
- Wiki：`F:\wiki\ailearing`

注意：

- 当前所有变更都只做了本地提交，**没有推送远端**
- 后续可以继续本地提交，但不要主动 push

## 2. 当前产品定义

LunaAgentOS 当前已经收敛出一版明确的 `Stage 1` 定义：

- 当前阶段的目标不是替代模型能力，而是先拿到**最小异构控制台雏形**
- 左侧是 `provider / agent` 舰队与配置区
- 中间是 `主 Agent 多会话卡片工作台`
- 右侧是 `按日期归档的历史任务`
- 当前阶段重点是**主 Agent 入场机制**
- 退出机制、调用流、多 Agent 编排先不做

当前内部阶段命名统一为：

- `Stage 1`：最小异构雏形
- `Stage 2`：调用流
- `Stage 3`：更完整的协作工作台
- `Stage 4`：控制平面

注意：

- 这是**内部推进阶段**
- 不是对外发布版本号

一句话理解：

> 先把 `Claude + Hermes` 跑进同一个桌面工作台，再把“设主 Agent -> 发任务 -> 会话卡片入场 -> 历史归档”这条链路跑通。

## 3. 关键交互模型

### 3.1 启动时做什么

启动时只做两件事：

1. 展示左侧 provider / agent 舰队
2. 后台异步读取右侧历史任务

当前不做：

- 启动自动拉起 Claude 会话
- 启动自动探测并打开真实 CLI
- 点击左侧 agent 刷新主区

目标是：

- 首屏先起来
- 重操作留给显式用户动作

### 3.2 左侧区域

左侧不是工作区切换器，而是：

- provider / agent 舰队展示区
- 主 Agent 设定区
- provider 管理入口预留区
- 新增 agent 入口预留区

当前约束：

- 点击左侧 agent 默认**不刷新主区**
- 左侧主要承担“展示与配置”，不承担“切页”

### 3.3 中间区域

中间区域是**会话工作台**，不是单会话详情页。

规则：

- 启动时可以为空
- 用户把任务发送给主 Agent 后，第一张卡片才入场
- 后续每发一次任务，就新增一张会话卡片

每张卡片的核心内容是：

- 输出流
- 思考流
- 最终响应

卡片顶部只轻量展示：

- agent 名称
- 当前状态
- 当前任务

卡片交互要求：

- 每张卡片独立滚动
- 每张卡片支持全屏
- 当前阶段先做“入场机制”
- “退出 / 回收 / 调度”暂不处理

### 3.4 右侧区域

右侧当前先只做：

- 历史任务展示
- 按日期分组
- 从本地 JSON 读取

当前不做复杂恢复逻辑。

## 4. 为什么必须设置主 Agent

主 Agent 不是装饰，而是必须定义：

- 当前用户输入默认发给谁

所以当前阶段里：

- 所有输入默认只发给主 Agent
- 其它 agent 的唤起属于后续“调用流”问题
- 当前阶段先不展开多 Agent 协调

## 5. 当前运行时接入状态

### Claude Code CLI

状态：

- 已真实接入
- 发送任务时会真实调用 Claude CLI
- 已能解析 `stream-json` 结果并映射到卡片内容

当前价值：

- LunaAgentOS 已经开始替代 Claude CLI 的入口层

### Hermes

状态：

- 已在 WSL 中真实探测到
- 还没接通真实任务执行链路

当前定位：

- `Stage 1` 的必要组成部分

### Trae IDE

状态：

- 当前只保留产品位
- 不伪装成原生 CLI
- 未来按 Bridge 路线进入

## 6. 这轮刚完成的工作

本轮重点是：

> 继续打磨 Stage 1 的启动与静默体验

已经完成：

1. 首屏改成先起工作台骨架，历史任务后台异步加载
2. `刷新状态` 只做显式运行时探测，不再牵连主工作台
3. `发送 / 发给主 Agent` 改成“卡片先入场、CLI 后台运行”
4. 顶部增加轻量状态条，不再用弹窗打断用户
5. 文档与 wiki 已同步到“静默启动 / 后台补历史 / 显式探测 / 后台运行”的口径

## 7. 当前代码重点位置

### 前端主逻辑

文件：

- `F:\codes\LunaAgentOS\desktop-shell\src\main.js`

当前关键点：

- `MAIN_AGENT_KEY` 用 `localStorage` 持久化主 Agent
- `startSessionFromPrompt()` 是当前发任务主入口
- `startClaudeSession()` 会真实调用 Claude CLI
- `refreshRuntimeStatus()` 只做 runtime probe
- `loadHistory()` 改成启动后异步读取
- `setAppNotice()` 负责静默反馈
- 现在发送任务是**非阻塞**的：卡片先入场，后台再等 CLI 结果

### 前端结构

文件：

- `F:\codes\LunaAgentOS\desktop-shell\src\index.html`

当前结构：

- 顶部：品牌 + 状态提示 + 刷新状态 + 发给主 Agent
- 左侧：舰队区
- 中间：工作台 + 会话卡片区 + 输入区
- 右侧：历史任务区

### 前端样式

文件：

- `F:\codes\LunaAgentOS\desktop-shell\src\styles.css`

当前重点：

- 卡片独立滚动
- 顶部状态条样式
- 按钮 loading / disabled 态

### Rust 后端

文件：

- `F:\codes\LunaAgentOS\desktop-shell\src-tauri\src\lib.rs`

当前命令：

- `probe_runtimes`
- `run_claude_stream`
- `load_history_entries`
- `append_history_entry`

当前状态：

- Windows 下已尽量使用隐藏窗口方式创建命令进程
- 但是否 100% 没有 CLI 窗口闪出，还需要做一轮肉眼终检

## 8. 当前文档入口

Repo 内重点文档：

- `F:\codes\LunaAgentOS\README.md`
- `F:\codes\LunaAgentOS\README_CN.md`
- `F:\codes\LunaAgentOS\docs\mvp-v1-interaction-model.md`
- `F:\codes\LunaAgentOS\docs\version-roadmap.md`
- `F:\codes\LunaAgentOS\docs\desktop-shell-validation.md`
- `F:\codes\LunaAgentOS\docs\competitive-positioning.md`
- `F:\codes\LunaAgentOS\docs\light-core-principles.md`

本交接文件：

- `F:\codes\LunaAgentOS\docs\handoff-next-agent.md`

## 9. 当前可执行产物

当前 release 产物：

- `F:\codes\LunaAgentOS\desktop-shell\src-tauri\target\release\desktop-shell.exe`

当前无 installer 验证路径可用，构建已通过。

## 10. Git 状态

LunaAgentOS 当前状态：

- 本地 `master` 比 `origin/master` ahead
- 不要主动 push

最近关键提交包括：

- `0666671` `feat: pivot shell to main-agent session workspace`
- `2e0c664` `docs: add LunaAgentOS version roadmap`
- `5d82c6d` `refactor: smooth startup and quiet runtime interactions`

Wiki 当前也已本地提交，口径与 repo 已对齐。

## 11. Wiki SOP（必须遵守）

如果后续要继续改 wiki，必须遵守：

1. 先读：
   - `F:\wiki\ailearing\SCHEMA.md`
   - `F:\wiki\ailearing\index.md`
2. 改 `concepts/` 后必须同步：
   - `index.md`
   - `log.md`
3. 完成后必须在 `F:\wiki\ailearing` 本地 git commit

禁止修改：

- `F:\wiki\trade-system`
- `F:\wiki\social-media`

## 12. 最建议下一个 Agent 继续做什么

优先顺序建议：

1. 做一轮真实桌面终检
   - 打开 exe
   - 观察启动是否仍有卡顿
   - 观察启动是否还有命令框闪出
   - 观察点击 `刷新状态` 是否闪窗
   - 观察点击 `发送` 是否闪窗

2. 继续收口静默体验
   - 如果还有 CLI 窗口闪出，继续修 Windows 静默路径
   - 尽量让所有占位反馈都走状态条，不弹窗

3. 打磨 Claude 多会话体验
   - 现在已经是卡片先入场
   - 可以继续补：
     - 运行中 loading 态
     - 错误态样式
     - 卡片间距与全屏细节

4. 推进 Hermes 真实执行
   - 当前只是 WSL probe
   - 这是 `Stage 1` 必须完成项，不再后移

## 13. 一句话交接

现在的 LunaAgentOS 已经从“协议 POC”推进到“可构建的桌面工作台”，并且 `Claude` 已真实接入。当前最适合继续推进的是：

> 盯启动与发送时的静默体验做终检，然后把 `Hermes` 从“已探测”推进到“真实执行”，让 `Stage 1` 的最小异构雏形真正成立。
