# LunaAgentOS Stage 1 对齐提示词

把下面这段提示词直接交给其它 agent 使用。目标是让它先对齐我们已经收敛好的 `Stage 1` 范围、当前代码状态，以及 `llm-wiki` 的工作规则，再继续往下做。

---

你现在接手的是 `LunaAgentOS` 的 `Stage 1` 工作。请先严格按下面的上下文对齐，不要先发散设计，也不要擅自扩大范围。

## 1. 项目定位

`LunaAgentOS` 当前不是在做“另一个底层 Agent”，而是在做：

- **异构 Agent 的桌面控制台**
- **现有 CLI / IDE Agent 之上的统一入口层**
- **未来的控制层 / Control Console**

当前产品分层已经明确：

- `Claude Code`：强大入口
- `Hermes`：通用入口
- `Trae IDE`：免费入口

当前内部推进节奏请按 `Stage 1 / 2 / 3 / 4` 理解。

注意：

- 这是**内部推进阶段**
- 不是对外发布版本号

## 2. Stage 1 的核心目标

`Stage 1` 的真实目标是：

- 用户不再直接进入 `Claude CLI`
- `Hermes` 也真实进入同一工作台
- 在 `LunaAgentOS` 里设定主 Agent
- 在桌面工作台里发送任务
- 看到输出流 / 思考流 / 最终响应
- 历史任务能被本地沉淀

换句话说：

> `Stage 1` 先拿到 `Claude + Hermes` 的最小异构控制台雏形。

## 3. Stage 1 的边界

请把范围严格控制在下面这条主链路：

1. 启动桌面控制台
2. 左侧展示 provider / agent 舰队
3. 右侧展示历史任务
4. 用户设定主 Agent
5. 用户输入任务并发送给主 Agent
6. 中间工作台生成一张新的 agent 会话卡片
7. 卡片承载输出流、思考流、最终响应
8. 会话结果写入按日期归档的历史 JSON

补充约束：

- `Stage 1` 至少要同时成立两种入口：
  - `Claude Code`
  - `Hermes`
- 如果只有 Claude，这仍然会被误解成“Claude 的桌面壳”

### 当前明确不做

- 复杂多 Agent 调度
- 调用流编排
- 退出机制
- 会话回收与归档动画
- 独立工具大面板
- 启动时自动拉起真实 CLI
- 点击左侧 agent 刷新主区

## 4. 三区职责

### 左侧：舰队与配置区

左侧不是工作区切换器，而是：

- provider / agent 展示区
- 主 Agent 设定区
- provider 管理入口预留区
- 新增 agent 入口预留区

约束：

- 点击左侧 agent 默认不刷新主区
- 左侧主要承担展示与配置，不承担切页

### 中间：会话工作台

中间区域是 **agent 会话卡片工作台**，不是单会话详情页。

规则：

- 启动时可以为空
- 用户第一次把任务发给主 Agent 后，第一张卡片入场
- 后续每发起一次主 Agent 会话，就新增一张卡片

每张卡片的核心内容是：

- 输出流
- 思考流
- 最终响应

卡片顶部只保留轻量信息：

- agent 名称
- 当前状态
- 当前任务

卡片交互要求：

- 每张卡片独立滚动
- 每张卡片支持全屏
- 当前阶段优先实现入场机制

### 右侧：历史任务

右侧当前只做：

- 历史任务列表
- 按日期分组
- 从本地 JSON 读取

当前不做复杂恢复逻辑。

## 5. 为什么必须设置主 Agent

`Stage 1` 必须显式定义主 Agent，因为：

- 用户输入默认发给谁，必须先有答案

所以当前规则是：

- 所有输入默认只发给主 Agent
- 其它 agent 的唤起属于后续“调用流”问题
- 先把主 Agent 作为唯一明确入口稳住

## 6. 当前运行时状态

### Claude Code

当前状态：

- 已真实接入
- 可从桌面壳里真实发送任务
- 已能把 CLI 返回结果映射到会话卡片

### Hermes

当前状态：

- 已在 WSL 中真实探测到
- 还没有接通真实任务执行链路，但它属于 `Stage 1` 必须完成项

### Trae IDE

当前状态：

- 只保留产品位
- 不伪装成 CLI
- 后续按 Bridge 路线推进

## 7. 当前启动与静默体验要求

请保持以下约束，不要回退：

- 首屏先起工作台骨架
- 历史任务后台异步加载
- 启动时不自动拉起 Claude 会话
- `刷新状态` 只做显式 runtime probe
- `发送 / 发给主 Agent` 采用“卡片先入场，CLI 后台运行”
- 占位交互尽量走状态条，不用弹窗打断用户
- 尽量避免 CLI 命令窗口闪出

## 8. 当前技术栈与代码位置

当前主栈：

- `Tauri 2 + Rust`

关键文件：

- `F:\\codes\\LunaAgentOS\\desktop-shell\\src\\main.js`
- `F:\\codes\\LunaAgentOS\\desktop-shell\\src\\index.html`
- `F:\\codes\\LunaAgentOS\\desktop-shell\\src\\styles.css`
- `F:\\codes\\LunaAgentOS\\desktop-shell\\src-tauri\\src\\lib.rs`

关键文档：

- `F:\\codes\\LunaAgentOS\\docs\\mvp-v1-interaction-model.md`
- `F:\\codes\\LunaAgentOS\\docs\\version-roadmap.md`
- `F:\\codes\\LunaAgentOS\\docs\\desktop-shell-validation.md`
- `F:\\codes\\LunaAgentOS\\docs\\handoff-next-agent.md`

## 9. 当前最应该继续做的事

优先级建议：

1. 继续打磨 `Stage 1` 的启动与静默体验
2. 做一轮真实桌面终检，确认是否还有 CLI 窗口闪出
3. 打磨 Claude / Hermes 双入口下的主 Agent 多会话体验
4. 先完成 `Stage 1`，再进入 `Stage 2` 的调用流

不要一上来就扩到复杂多 Agent 编排。

## 10. llm-wiki 工作要求

LunaAgentOS 的调研、架构决策、协议规范都必须同步到本地 wiki。

Wiki 根目录：

- `F:\\wiki\\ailearing`

### 开始前必须先读

1. `F:\\wiki\\ailearing\\SCHEMA.md`
2. `F:\\wiki\\ailearing\\index.md`

### Wiki SOP

如果修改或新增 `concepts/` 下的内容，必须：

1. 先查重，避免重复页面
2. 更新 `index.md`
3. 在 `log.md` 末尾追加操作记录
4. 在 `F:\\wiki\\ailearing` 本地执行 git commit

### 红线

禁止修改：

- `F:\\wiki\\trade-system`
- `F:\\wiki\\social-media`

禁止：

- 跳过 `index.md`
- 跳过 `log.md`
- 不提交就结束任务

## 11. 交付时请遵守

如果你继续修改代码或文档，请在最终结果里说明：

- 你理解的 `Stage 1` 边界有没有变化
- 你具体改了哪些文件
- 你验证了什么
- 是否更新了 wiki
- 是否做了本地 git commit

如果你发现当前需求和代码实现不一致，优先先对齐需求，不要直接扩设计。

---

如果你要继续推进，请先读以下文件再动手：

- `F:\\codes\\LunaAgentOS\\docs\\handoff-next-agent.md`
- `F:\\codes\\LunaAgentOS\\docs\\mvp-v1-interaction-model.md`
- `F:\\codes\\LunaAgentOS\\desktop-shell\\src\\main.js`
- `F:\\wiki\\ailearing\\SCHEMA.md`
- `F:\\wiki\\ailearing\\index.md`
