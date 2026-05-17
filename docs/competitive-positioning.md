# LunaAgentOS 竞品定位：amux / Goose / Fusion

## 目的

这份文档只盯 3 个最接近 LunaAgentOS 的方向性竞品：

- `amux`
- `Goose`
- `Fusion`

目标不是做大而全竞品报告，而是回答 4 个最实用的问题：

1. 他们在竞争什么
2. 给 LunaAgentOS 留下的生存空间在哪里
3. 他们的产品形态是什么
4. 我们可以借鉴哪些成熟能力

## 总结先行

### 最像我们未来方向的

- `amux`

它最接近“control plane / fleet management”这层。

### 最容易吃掉我们接入层价值的

- `Goose`

它已经把“统一入口 + 多 provider + 桌面/CLI/API”做得很完整。

### 最容易把故事讲得比我们更大的

- `Fusion`

它更像 Agent 软件工厂和多节点编排系统。

## 一、他们在竞争什么

### amux：Agent Control Plane 心智

amux 直接把自己定位成“AI coding agents 的 control plane”。官方材料持续强调：

- lifecycle management
- observability
- fault tolerance
- orchestration
- governance and cost control

它竞争的不是单个 Agent 的智能，而是：

**“当你已经跑很多 coding agents 时，应该用什么系统来管理它们。”**

参考：

- [amux features](https://amux.io/features/)
- [amux control plane guide](https://amux.io/guides/agent-control-plane/)

### Goose：统一 Agent 入口

Goose 的官方定位很清晰：

- Desktop app
- CLI
- API
- MCP 扩展
- CLI providers

它竞争的是：

**“不管你用哪个模型或哪种 CLI，直接进入 Goose 这个统一入口。”**

而且它已经能把 Claude Code 等 CLI provider 接进自己的统一体验里。^[raw/articles/goose-cli-providers-official-2026-05-18.md]

参考：

- [Goose homepage](https://goose-docs.ai/)
- [Goose CLI providers](https://block.github.io/goose/docs/guides/cli-providers/)

### Fusion：Agent 编排工厂

Fusion 竞争的是：

**“让一群 Agent 围绕软件任务持续生产，并在一个系统里被计划、审核、执行、合并。”**

它的核心表达是：

- one pane of glass
- worktree isolation
- plan → review → execute → review
- mission hierarchy
- auto-merge

它抢的是：

**“复杂任务编排与持续交付的操作系统。”**

参考：

- [Fusion homepage](https://runfusion.ai/)

## 二、他们给我们留的生存空间

### amux 留出的空间

amux 很强，但它更偏：

- 运维视角
- fleet 视角
- overnight / unattended agent management
- dashboard / control plane

它留给 LunaAgentOS 的空间是：

**“更轻、更桌面、更适合个人和小团队的日常 Agent 工作台。”**

也就是说，我们可以不先做成“大运营台”，而先做成：

- 启动快
- 占用轻
- 面板清晰
- 每天真开着用的桌面控制台

### Goose 留出的空间

Goose 已经非常强，但它的中心仍然是：

- Goose 自己是一个完整 Agent
- CLI provider 是便捷接入，而不是 Goose 的全部定义

官方也明确提醒：CLI providers “不完全支持所有 Goose 功能”，有平台和能力限制，只是“convenience”。  
这说明 Goose 更像“把别人的 CLI 收编进 Goose”，而不是一个彻底中立的控制层。

这给我们留下的空间是：

**“中立工作台，而不是另一个超级 Agent。”**

参考：

- [Goose CLI providers](https://block.github.io/goose/docs/guides/cli-providers/)

### Fusion 留出的空间

Fusion 很完整，但也非常重：

- 多节点
- 多层任务结构
- worktree orchestration
- merge pipeline
- quality gates

这给我们留下的空间反而很明确：

**“不要一上来做 AI 软件工厂，而先做轻量桌面控制台。”**

换句话说：

- Fusion 更像“系统化生产平台”
- LunaAgentOS 第一阶段更适合做“异构 Agent 的轻控制台入口”

## 三、他们的产品形态在哪里

### amux 的产品形态

amux 当前产品形态更像：

- control plane
- web dashboard
- mobile PWA
- watchdog + orchestration + board

它不是在卖“更好的单次对话”，而是在卖：

**“你怎么把一群 Agent 管起来。”**

### Goose 的产品形态

Goose 当前产品形态更像：

- 通用 Agent 产品
- 桌面 app
- CLI
- API
- 扩展生态
- provider 接入

它不是纯 adapter，也不是纯 dashboard，而是：

**“自带能力的大一统 Agent 入口。”**

### Fusion 的产品形态

Fusion 当前产品形态更像：

- 编排平台
- AI 开发工厂
- 多节点任务系统
- git / worktree / review workflow OS

它的产品形态不是“轻工具”，而是：

**“AI 开发工作的结构化操作环境。”**

## 四、我们最该借鉴什么

### 从 amux 借鉴

最值得借的不是它的完整形态，而是它最轻的一刀：

- **watchdog / restart / replay 思维**

原因：

- 这直接解决 Agent 真实世界会崩、会卡、会溢出的现实问题
- 非常轻
- 很有控制层价值
- 普通懂点开发的人也能立刻感知它的 usefulness

### 从 Goose 借鉴

最值得借的是：

- **统一入口**
- **已有订阅照样用**

Goose 做得很成熟的一点是：不要求用户换掉已有模型和订阅，而是把它们纳入统一使用面。

这对 LunaAgentOS 非常关键：

**不要逼用户抛弃 Claude / Trae / 其他现成产品，而要让他们把这些东西一起带进来。**

### 从 Fusion 借鉴

最值得借的是：

- **任务流清晰可见**

Fusion 的 `plan → review → execute → review` 很重，但它提醒我们一件事：

Agent 工作不能只是滚动聊天记录，必须变成结构化、可见的状态流。

LunaAgentOS 不必照搬 Fusion 的重量，但很值得借它：

- 状态分阶段表达
- 任务卡片化
- 人类控制点

## 五、我们最轻、最核心的一点应该学什么

如果只学他们最轻、最核心、最适合第一版普通开发者用户的能力，我建议只抓这 3 个：

1. **amux 的 watchdog 思维**
2. **Goose 的统一入口思维**
3. **Fusion 的任务状态可见思维**

把这三者压缩后，LunaAgentOS 第一版最该学的是：

**“一个轻量桌面工作台，能统一接入现成 Agent，并且让任务状态清楚可见。”**

## 六、LunaAgentOS 当前应该怎么定位

结合这 3 个竞品，LunaAgentOS 当前最好的定位不是：

- 另一个大一统 Agent
- 另一个重 control plane
- 另一个 AI 工厂

而是：

**异构 Agent 的轻量桌面控制台。**

它的关键词应该是：

- 中立
- 轻量
- 桌面优先
- 状态可见
- 人类可控

## 结论

amux、Goose、Fusion 都很强，但它们也各自留下了空位：

- amux 留下了“更轻、更桌面”的空位
- Goose 留下了“更中立、更像控制层”的空位
- Fusion 留下了“更易上手、不那么重平台”的空位

LunaAgentOS 最应该抢的，不是“我也能接很多 Agent”，而是：

**“不管你用哪个 Agent，LunaAgentOS 都是你管理它们的轻量桌面工作台。”**
