# Codex 协作优化说明

## 目的

这份文档不是产品文档，而是为了优化当前仓库里的 Codex / agent 协作体验。  
目标是：

- 减少新 agent 上手时间
- 降低重复判断和反复跑偏
- 固化审查方法
- 固化 wiki 写入流程

## 已经做的优化

### 1. 根目录 `AGENTS.md`

已新增：

- `AGENTS.md`

作用：

- 给任何进入仓库的 agent 一个稳定的项目心智
- 统一 Stage 口径
- 统一 Claude / Hermes / session / 当前发送目标 的建模边界
- 固化 wiki 红线

### 2. 关键交接文档

当前建议 agent 优先阅读：

- `README_CN.md`
- `docs/mvp-v1-interaction-model.md`
- `docs/version-roadmap.md`
- `docs/handoff-next-agent.md`
- `docs/prompt-v1-alignment.md`
- `docs/hermes-tui-direction.md`

### 3. 代码评审方法固定

默认要求：

- Findings first
- 优先 bug / 风险 / 回归
- 没问题也要说明剩余风险和测试空白

## 推荐给 Codex 的工作顺序

### 新任务进入时

1. 读 `AGENTS.md`
2. 读当前最相关的产品文档
3. 确认任务属于哪个 Stage
4. 判断是否涉及 wiki
5. 再动代码

### 涉及 Stage 1 时

默认优先级：

1. 不破坏 `Claude + Hermes` 的最小异构雏形
2. 不把会话工作台改回单页详情
3. 不把“当前发送目标”误做成“系统只有一个 Agent”
4. 不把 Claude 内部 subagent 误提升为左侧多个外部 agent

### 涉及 Hermes 时

优先原则：

- 过程可见性 > 只看最终结果
- 活会话感 > 普通消息列表感
- TUI 感 > 快速堆更多功能

## 建议长期维护的 Codex 资产

### 必须维护

- `AGENTS.md`
- `docs/handoff-next-agent.md`
- `docs/prompt-v1-alignment.md`

### 建议后续再补

- `docs/review-checklist.md`
  - 固化审查清单
- `docs/runtime-model.md`
  - 固化入口 / 会话 / 调用流 / 内部 subagent 的术语边界
- `docs/wiki-writing-guide.md`
  - 固化 LunaAgentOS 写入 ailearing wiki 的最小模板

## 代码评审清单（可直接复用）

任何较大改动，默认检查：

1. 是否破坏当前 Stage 边界
2. 是否把产品模型做回单页 / 单 Agent
3. 是否影响启动静默体验
4. 是否影响会话卡片独立滚动和全屏
5. 是否影响历史会话的持久化与恢复
6. 是否让 Hermes 的过程可见性变差
7. 是否需要同步 wiki

## Wiki 工作清单（可直接复用）

如果本轮任务触发知识沉淀：

1. 先读 `SCHEMA.md`
2. 再读 `index.md`
3. 查重
4. 更新 `concepts/`
5. 更新 `index.md`
6. 更新 `log.md`
7. 本地 git commit

## 一句话建议

Codex 在这个仓库里最值钱的，不是“更快写一段代码”，而是：

**持续维持 LunaAgentOS 的产品边界、术语边界和工程节奏不跑偏。**
