# Hermes ACP Profile Runtime

[中文](./hermes-acp-profile-runtime.zh-CN.md)

This document explains how LunaAgentOS treats Hermes as a real profile-based runtime entry.

## Runtime principle

LunaAgentOS uses the Hermes ACP surface as the main Runtime Session path:

```text
hermes acp --accept-hooks
```

Runtime surface priority:

1. `hermes acp`: main path for structured editor-style runtime sessions.
2. `hermes gateway`: planned path for background service or channel-based scenarios.
3. `hermes -z`: fallback or smoke-test path for lightweight checks.

## Profile loading

Hermes profiles are loaded dynamically from the Hermes CLI through WSL:

```text
wsl.exe -e hermes profile list
wsl.exe -e hermes profile show <profile>
```

The frontend maps returned profiles into real send targets under the Hermes provider.

Profile metadata kept by LunaAgentOS:

- `profileName`
- `profileAlias`
- `profileExecutable`
- `profilePath`
- `profileModel`
- `gateway`
- `skillCount`
- `hasSoul`

Sensitive values do not enter the UI or history, including `.env` content, tokens, and API keys.

## ACP startup semantics

`profileExecutable` means the executable route used to start Hermes ACP.

- Default profile: use `hermes acp --accept-hooks`.
- Profile alias: use the alias executable, such as `/root/.local/bin/ailearing acp --accept-hooks`.

On Windows, Rust starts the process through WSL:

```text
wsl.exe -- <profileExecutable> acp --accept-hooks
```

Subprocess creation uses hidden-window behavior on Windows to keep runtime operations quiet.

## Session and history

Hermes sessions keep profile metadata on the frontend session object and save it into turn metadata:

```text
turn.meta.hermesProfile
```

History restore uses the saved runtime and profile identity to recover the most accurate card title, profile label, and runtime route available.

## UI constraints

Hermes is a real provider that exposes runtime instances and profile targets.

Session cards show concrete runtime/profile identity, for example:

```text
Hermes · WSL / ailearing
profile: ailearing · qwen3.6-plus
```

Hermes UX makes slow work visible instead of hiding it behind a final-only response. The card surfaces:

- Output stream
- Thought stream
- Tool/runtime stream
- Plan updates
- Usage updates
- Final response

## Next improvements

- Continue improving Hermes ACP event hierarchy and de-noising.
- Improve profile caching so WSL probing feels lighter.
- Keep load/resume behavior explicit and recoverable.
- Keep one-shot mode separate from the Runtime Session model.
