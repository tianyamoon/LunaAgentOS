# Current Product Boundary

[中文](./current-boundary.zh-CN.md)

LunaAgentOS 0.1 Preview is a neutral desktop workspace for real AI agent sessions.

This page defines the release boundary: what exists now, what 0.1 Preview is intentionally not, and what the next layer should make possible.

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

## What it is not now

- It is not a single built-in agent runtime that absorbs external products.
- It is not a complete multi-agent orchestration platform.
- It is not a marketplace or broad commercial platform.
- It does not make every agent internally identical.
- It does not provide a shared memory bus across agents.
- It does not present remote or team entry points as available 0.1 Preview features.

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

Adding a new agent product should follow adapter/plugin installation and normalized Runtime Session events. That path is the next integration model, not a promise that every possible adapter is already production-ready.

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

The next layer is not a rebrand and not a jump to a full orchestration platform. It should focus on:

- Hardening Claude Code and Hermes runtime entry reliability.
- Making local history and restore behavior easier to trust.
- Clarifying adapter installation and capability boundaries.
- Strengthening the Trae IDE bridge path.
- Designing targeted session handoff so users can intentionally move selected context between entries or sessions when that capability is actually implemented.
