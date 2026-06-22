# Current Product Boundary

[中文](./current-boundary.zh-CN.md)

LunaAgentOS is heading toward a personal Agent operating system for the AI era — a desktop layer where users install agents like apps, schedule tasks like processes, and own agent memory like local files. 0.2 Preview lays down the foundational capabilities on the way to that goal: a credible, archivable, neutral desktop workspace that hosts real AI agent sessions.

This page captures the current release boundary: what is actually built today, where the next stretch of road goes, and which common misreadings to clear up early.

## What it is now

- **A neutral desktop workspace**: the app gives real AI agent sessions a shared local surface without claiming ownership of the agents themselves.
- **Windows-first**: the current product path is the Tauri desktop app on Windows.
- **A real-session workspace**: the central object is a Runtime Session Card, not a generic chat bubble list.
- **A local-first history surface**: session turns, archived sessions, restore actions, and read-only history states are kept locally.
- **A workspace experience supported by protocol and adapters**: the protocol, adapter boundary, and Runtime Session Model are the supporting structure, not the product surface itself.

## What works now

- Claude Code can be used as a real runtime entry.
- Hermes can be used through Windows / WSL ACP runtime instances and profiles.
- Trae IDE remains a documented IDE-first bridge path, but it is not surfaced in the current desktop Agent Fleet until the bridge is real.
- The left side shows the Agent Fleet and current send target.
- The center workspace shows active Runtime Session Cards.
- Each card holds output stream, thought stream, runtime stream, and final response.
- The right side separates live sessions from archived sessions.
- Local JSON history stores session turns and supports restore/read-only states.
- When a surfaced runtime entry is not installed, its entry remains visible in the Agent Fleet with a clear configuration state. This is an explainable state, not a crash or silent failure.

## How far the full form still is

The current 0.3 stage closes out Agent management, runtime-backed health diagnostics, and Runtime Session semantics:

- **Agent management**: identity, environment, Profile, working directory, model control, capabilities, safety, and best practices.
- **Health diagnostics**: conclusions come only from real runtimes, adapter health checks, or verifiable configuration; unconfirmed facts stay unknown.
- **Runtime Session**: remains responsible only for session state, execution, responses, history, and recovery.
- **Explicitly outside 0.3**: Task, Task Board, Handoff, automatic assignment, multi-Agent orchestration, team mode, shared memory, and Marketplace.

A few boundaries are worth stating once, to keep LunaAgentOS from being mistaken for something it is not:

- It does not absorb external agents into a single built-in runtime — each agent keeps its own internal mechanism.
- The adapter layer is a translator, not a homogenizer.

## Modeling rules

### External entries

The left fleet represents external entry objects:

- Claude Code
- Hermes
- Future Trae IDE bridge path

Claude internal subagents or delegation workers remain part of Claude's own internal mechanism.

### Adapter boundary

Claude Code and Hermes are real runtime entries that validate the contract.

The adapter rule is:

```text
new agent product -> adapter manifest + adapter implementation -> LunaAgentOS unified JSON contract
```

New agent products enter through adapter/plugin installation and normalized Runtime Session events. The adapter contract is the integration surface for that path and is still being polished.

### Current send target

The current send target answers: “where does the next user input go by default?”

The active session workspace remains the center of multi-session work.

### Runtime Session Cards

A session card is the shared surface for:

- Stable Session title
- User prompt for each Turn
- Runtime output
- Thought stream
- Runtime/tool/plan/usage stream
- Final response
- Local history and restore state

## Next layer

0.3 builds on the workspace foundation. It focuses on:

- Making Agent availability, evidence, and next steps understandable.
- Offering LunaAgentOS model selection only where a persistent runtime-backed default is real.
- Keeping Runtime Session, Turn, and future Task fields and semantics separate.
