# 轻核心原则

[English](./light-core-principles.md)

LunaAgentOS 最有力量的时候，是控制层保持聚焦的时候。

这些原则解释了“轻核心”在实践里到底意味着什么。

## 1. 把 runtime 特有逻辑尽量留在边缘

不同 runtime 会暴露不同 surface 和行为。LunaAgentOS 只规范协调、历史和可见性真正需要的部分，把 runtime 原生行为尽量留在 adapter 一侧。

## 2. 让人的工作空间保持连贯

产品应该帮助操作者快速理解：

- 当前在用哪个 runtime
- 哪个 session 处于活跃状态
- runtime 现在正在做什么
- 哪些历史之后可以恢复

目标不是做更多装饰，而是减少困惑。

## 3. 保留原生强项

Claude Code、Hermes 和未来的入口都应该保留自己的个性。LunaAgentOS 要做的是让它们更容易一起被观测和操作，而不是把它们压成一个通用回复面板。

## 4. 把过程可见性当成产品价值

thought、tool、plan、usage、state 这些事件不是调试残留物。只要暴露方式合适，它们本身就是控制层的重要产品价值。

## 5. 优先建设可持续 session，而不是一次性 prompt

LunaAgentOS 围绕 Runtime Session 组织，而不是围绕“发一次、回一次”的请求组织。历史、恢复行为和 session identity 都是核心产品形态的一部分。

## 6. 先把 contract 做扎实，再讲平台故事

只有当 contract 稳定到足以接入新 runtime 而不需要不断写特例时，extension model 才算真的成立。

这意味着项目应先加强：

- adapter manifest
- normalized runtime events
- capability modeling
- 本地历史和恢复行为
- workspace routing semantics

## 7. 对当前边界保持诚实

轻核心要想可信，就必须明确说清楚：什么已经可用，什么还只是方向，什么应该放到下一层去做。
