# Hermes ACP Profile Runtime

[English](./hermes-acp-profile-runtime.md)

这份文档解释 LunaAgentOS 如何把 Hermes 作为真实的、基于 profile 的 runtime entry 来处理。

## Runtime 原则

LunaAgentOS 使用 Hermes ACP surface 作为主要 Runtime Session 路径：

```text
hermes acp --accept-hooks
```

Runtime surface 优先级：

1. `hermes acp`：结构化 editor-style runtime sessions 的主路径。
2. `hermes gateway`：面向后台服务或 channel-based 场景的计划路径。
3. `hermes -z`：轻量检查的 fallback 或 smoke-test 路径。

## Profile loading

Hermes profiles 通过 WSL 从 Hermes CLI 动态加载：

```text
wsl.exe -e hermes profile list
wsl.exe -e hermes profile show <profile>
```

Frontend 会把返回的 profiles 映射成 Hermes provider 下真实的 send targets。

LunaAgentOS 保存的 profile metadata：

- `profileName`
- `profileAlias`
- `profileExecutable`
- `profilePath`
- `profileModel`
- `gateway`
- `skillCount`
- `hasSoul`

敏感值不会进入 UI 或 history，包括 `.env` 内容、tokens 和 API keys。

## ACP startup semantics

`profileExecutable` 表示用于启动 Hermes ACP 的 executable route。

- Default profile：使用 `hermes acp --accept-hooks`。
- Profile alias：使用 alias executable，例如 `/root/.local/bin/ailearing acp --accept-hooks`。

在 Windows 上，Rust 通过 WSL 启动进程：

```text
wsl.exe -- <profileExecutable> acp --accept-hooks
```

Subprocess creation 在 Windows 上使用 hidden-window behavior，让 runtime 操作保持安静。

## Session 和 history

Hermes sessions 会把 profile metadata 保存在 frontend session object 上，并写入 turn metadata：

```text
turn.meta.hermesProfile
```

History restore 使用已保存的 runtime 和 profile identity，尽可能恢复准确的 card title、profile label 和 runtime route。

## UI constraints

Hermes 是真实 provider，会暴露 runtime instances 和 profile targets。

Session cards 展示具体 runtime/profile identity，例如：

```text
Hermes · WSL / ailearing
profile: ailearing · qwen3.6-plus
```

Hermes UX 让慢任务保持可见，而不是隐藏在只显示最终响应的界面后。Card surfaces 包括：

- Output stream
- Thought stream
- Tool/runtime stream
- Plan updates
- Usage updates
- Final response

## 下一步改进

- 继续改进 Hermes ACP event hierarchy 和 de-noising。
- 改进 profile caching，让 WSL probing 更轻。
- 保持 load/resume behavior 明确且可恢复。
- 让 one-shot mode 与 Runtime Session model 保持分离。
