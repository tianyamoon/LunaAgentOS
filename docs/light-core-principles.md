# LunaAgentOS 轻核心原则

LunaAgentOS 的核心原则是：**统一入口，状态可见，协议清晰，App 保持轻量。**

## 为什么保持轻核心

Coding Agent 本身已经承担模型调用、工具执行、文件操作和长任务运行。LunaAgentOS 不替代底层 Agent，也不把第一层产品做成重平台。

LunaAgentOS 聚焦上层控制：

- 连接外部 Agent。
- 展示 runtime availability。
- 发送任务到明确 target。
- 观察 output、thought、tool、plan、usage 和 state。
- 保存本地 history。
- 支持 session restore 和错误态。

## 当前轻核心

当前产品核心由四部分组成：

```text
Protocol
  -> Adapter Contract
  -> Runtime Session Model
  -> LunaAgentOS App
```

这些部分共同提供：

- Agent Fleet。
- 当前发送目标。
- Runtime Session Cards。
- 活会话 / 归档会话。
- 本地 JSON history。
- Runtime detection。
- first-party Claude Code 和 Hermes entries。
- Trae IDE bridge entry。

## 做什么

LunaAgentOS 当前优先做：

- 统一 runtime entry。
- 清晰 provider/runtime/profile 状态。
- 可观察 Runtime Session Card。
- 稳定本地 history 和 restore。
- Adapter manifest、capability 和 normalized event contract。
- Claude Code / Hermes runtime hardening。
- Trae IDE bridge path。

## 不做什么

LunaAgentOS 当前不把重心放在：

- 重云端平台。
- 企业治理后台。
- 一次性接入所有 Agent。
- 插件市场。
- 复杂商业化工作流。

这些能力属于更后面的控制平面阶段。当前轻核心先保证真实 runtime entry、清晰 session surface 和稳定 adapter boundary。

## 设计标准

一个新能力进入 LunaAgentOS 时，需要满足：

- 能通过 Adapter Contract 表达。
- 能进入 Runtime Session Model。
- 能被 App 清晰展示。
- 不破坏外部 Agent 的原生优势。
- 不把 runtime-specific 逻辑泄漏到通用 UI。

## 结论

轻核心让 LunaAgentOS 在保持可运行、可理解、可扩展的同时，为未来的 adapter ecosystem、collaboration workspace 和 control plane 留出空间。
