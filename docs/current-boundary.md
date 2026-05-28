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
- Trae IDE is represented as an IDE-first bridge path.
- The left side shows the Agent Fleet and current send target.
- The center workspace shows active Runtime Session Cards.
- Each card holds output stream, thought stream, runtime stream, and final response.
- The right side separates live sessions from archived sessions.
- Local JSON history stores session turns and supports restore/read-only states.
- When a runtime entry is not installed, its entry remains visible in the Agent Fleet with a clear configuration state. This is an explainable state, not a crash or silent failure.

## How far the full form still is

0.2 Preview is a foundation stage. The next stretch of road grows naturally in these directions:

- **Multi-agent orchestration**: the "current send target" carries single-track work today; cross-agent scheduling and collaboration is the headline of the next stage.
- **Cross-agent context bridging and shared memory**: first make sessions resumable in place, then targeted session handoff, and only then a shared memory bus across agents.
- **Remote and team entries**: an expansion direction for after the local experience is steady.
- **Agent marketplace and ecosystem layer**: the adapter manifest already reserves the integration surface; the product shape comes in later releases.

A few boundaries are worth stating once, to keep LunaAgentOS from being mistaken for something it is not:

- It does not absorb external agents into a single built-in runtime — each agent keeps its own internal mechanism.
- The adapter layer is a translator, not a homogenizer.

## Modeling rules

### External entries

The left fleet represents external entry objects:

- Claude Code
- Hermes
- Trae IDE bridge path

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

- User task
- Runtime output
- Thought stream
- Runtime/tool/plan/usage stream
- Final response
- Local history and restore state

## Next layer

The next layer builds on the 0.2 workspace foundation. It focuses on:

- Hardening Claude Code and Hermes runtime entry reliability.
- Making local history and restore behavior easier to trust.
- Clarifying adapter installation and capability boundaries.
- Strengthening the Trae IDE bridge path.
- Designing targeted session handoff so users can intentionally move selected context between entries or sessions when that capability is actually implemented.
