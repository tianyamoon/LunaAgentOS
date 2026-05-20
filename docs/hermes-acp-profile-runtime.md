# Hermes ACP Profile Runtime

## 目的

本文记录 LunaAgentOS Stage 1 中 Hermes 的技术接入方式。README 只保留项目概要，Hermes ACP、profile 元数据、历史恢复等实现细节集中放在这里。

## 接入原则

Stage 1 优先使用 Hermes 官方 ACP surface：

```text
hermes acp --accept-hooks
```

优先级：

1. `hermes acp`：桌面工作台与 editor-style runtime session 的主路径。
2. `hermes gateway`：后续消息通道、后台服务或多渠道场景再考虑。
3. `hermes -z`：只作为 smoke test 或临时 fallback，不标记为完整 RuntimeSession。

## Profile 载入

Hermes profiles 从 WSL 内的 Hermes CLI 动态读取：

```text
wsl.exe -e hermes profile list
wsl.exe -e hermes profile show <profile>
```

前端将返回的 profile 映射成左侧 Hermes provider 下的真实入口对象。

当前保留的 profile 元数据：

- `profileName`
- `profileAlias`
- `profileExecutable`
- `profilePath`
- `profileModel`
- `gateway`
- `skillCount`
- `hasSoul`

敏感信息不进入 UI 与 history，例如 `.env` 内容、token、API key。

## ACP 启动语义

前端内部字段使用 `profileExecutable` 表达实际启动 Hermes ACP 的可执行入口。

- default profile：回退到 `hermes acp --accept-hooks`
- profile alias：使用 alias executable，例如 `/root/.local/bin/ailearing acp --accept-hooks`

Windows 下由 Rust 通过 `wsl.exe` 启动：

```text
wsl.exe -- <profileExecutable> acp --accept-hooks
```

进程创建使用隐藏窗口 flag，避免桌面壳运行时闪出 CLI 窗口。

## Session 与历史

Hermes session 会在前端 session 对象里保留 profile 元数据，并在保存 turn 时写入：

```text
turn.meta.hermesProfile
```

历史恢复时按以下顺序回填 Hermes profile 身份：

1. `agentId`
2. `profileName`
3. `profileAlias`
4. `profilePath`

这样即使 Hermes profiles 是动态载入的，历史会话也能尽量恢复到正确 profile。

## UI 约束

Hermes 在 LunaAgentOS 中不是单一假入口，而是 profile-based 的真实入口组。

工作台卡片中应展示具体 profile 信息，例如：

```text
Hermes / ailearing
profile: ailearing · qwen3.6-plus
```

Hermes 的体验目标不是单纯更快，而是让运行过程可见：输出流、思考流、工具流、计划流都应尽量进入卡片。

当前前端会监听后端的 `runtime-session-update` 事件，并在会话卡片中实时追加：

- `agent_thought_chunk`：进入思考流
- `agent_message_chunk`：进入输出流
- `tool_call` / `tool_call_update`：进入运行流
- `plan`：进入运行流中的计划更新
- `usage_update`：进入运行流中的用量更新

## 当前后续项

- 继续打磨 Hermes ACP event 的展示层级与去噪。
- 增加 Hermes profile 缓存，避免 WSL 探测影响启动观感。
- 继续验证 load/resume 语义，不假定所有 ACP 实现完全等价。
- 保持 `hermes -z` 只作为 fallback / smoke test。
