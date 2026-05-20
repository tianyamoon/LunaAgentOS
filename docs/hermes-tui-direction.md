# Hermes TUI 方向说明

## 当前问题

Hermes 现在的问题不应简单理解为“启动慢”，更可能是：

1. Hermes 本身思考过程就慢
2. 当前 ACP 前后端链路采用“整轮等待后一次性回填”
3. 前端工作台没有把“正在工作”的过程感真正展示出来

用户当前体感是：

- 发送后长时间无反馈
- 最终只看到结果，没有明显的 `thinking / runtime` 过程
- 不像 Hermes 自己的 TUI，会缺少“活着的会话”感觉

## 已确认的技术事实

`desktop-shell/src-tauri/src/acp_runtime.rs` 的 `read_response()` 会在等待目标响应期间持续读取 `session/update`，并且已经支持映射这些事件：

- `agent_thought_chunk`
- `agent_message_chunk`
- `tool_call`
- `tool_call_update`
- `plan`
- `usage_update`

也就是说：

**后端并不是完全拿不到过程事件。**

当前缺口曾经主要在于：

- Tauri `invoke()` 仍然是“等整轮返回后一次性把 events 交给前端”
- 前端拿到的是整包事件，而不是边到边渲染

现在已经补上 `runtime-session-update` 事件通道。Rust 后端读到 `session/update` 后会推给前端，前端会实时追加到对应会话卡片。

后续重点从“有没有流”转为：

- 展示层级
- 去噪
- 更接近 Hermes TUI 的活会话感

## 正确方向

Hermes 这条线的正确方向不是单纯“更快”，而是：

**让慢变得可见。**

LunaAgentOS 里 Hermes 会话卡片应该尽量靠近 TUI 感：

1. 顶部只保留轻量元信息
   - profile / session 名
   - 当前状态
   - 当前任务

2. 主体以过程为核心
   - thinking stream
   - runtime stream
   - final response

3. 用户看到的不是“卡死”，而是“正在工作”

## 分阶段方案

### 第一阶段：体感止血

目标：
- 发送后立刻进入可见运行态

做法：
- 会话卡片在任务一发出后立刻切到 `THINK`
- 立刻显示 runtime log：
  - 正在启动 Hermes ACP
  - 正在连接 profile
  - 首次响应可能较慢

这个阶段不解决真流式，只解决“看起来卡死”。

### 第二阶段：工作台模型纠正

目标：
- 工作台不再是“只显示当前发送目标”

做法：
- 中间主区显示所有已激活会话
- 当前发送目标只决定“下一条消息默认发给谁”
- 当前发送目标对应会话置顶或高亮

这一步很重要，因为 TUI 感本质上属于“工作台”，不是“单详情页”。

### 第三阶段：真正过程流

目标：
- 把 ACP 的过程事件边读边渲染到前端

候选做法：
- Rust 后端收到 `session/update` 后通过事件通道推给前端
- 前端对正在运行的 session 卡片持续追加：
  - thought chunk
  - message chunk
  - tool / runtime update

一旦做到这一层，Hermes 才真正会像它自己的 TUI。

## 当前结论

对于 Hermes：

- 不要把重点放在“做得和 Claude 一样”
- 而要把重点放在“做出过程可见性”

一句话总结：

**Hermes 的价值不在结果页，而在活会话。**
