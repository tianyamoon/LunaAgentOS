# Product Definition

[中文](./product-definition.zh-CN.md)

LunaAgentOS is heading toward a personal Agent operating system for the AI era — a desktop layer where users install agents like apps, schedule tasks like processes, and own agent memory like local files.

LunaAgentOS 0.2 Preview starts from the neutral desktop workspace for real AI agent sessions, as the first foundational stone on that road. From the workspace, the product grows naturally into agent management, task management, handoff, collaboration, and control-plane behavior — a path that can be validated stage by stage.

The product starts from the workspace experience: choose a real runtime entry, send work into a real session, watch the process, and keep local history in one place. Protocol, adapters, and the Runtime Session Model support that experience; they are not the first thing LunaAgentOS asks users to believe.

## The 0.2 Preview product shape

LunaAgentOS 0.2 Preview is built around five concrete pieces:

- **LunaAgentOS App**: a Windows-first Tauri desktop workspace
- **Runtime Session Cards**: the shared surface for output, thought, runtime events, final response, and restore state
- **Local history**: JSON-backed session history with restore and read-only archived states
- **Real runtime entries**: Claude Code and Hermes as real external runtimes
- **Bridge path**: Trae IDE as an IDE-first bridge direction

## Supporting architecture

The workspace is supported by a small set of contracts:

- **Runtime Session Model**: the shared session, turn, lifecycle, and history model that the app renders consistently
- **Runtime Adapter / Plugin Contract**: the integration boundary for external agent products
- **Unified JSON contract**: stable shapes for adapter identity, runtime sessions, runtime events, capabilities, and history

The protocol defines the contract. The app proves that the contract is useful as a product experience.

## What works today

Today the app provides:

- A native Windows-first desktop window
- Agent Fleet and runtime configuration
- Claude Code as a real runtime entry
- Hermes through Windows / WSL ACP runtime instances and profiles
- Runtime Session Cards for live sessions
- Archived sessions and local history
- Restore actions and read-only history states
- Real runtime validation through Claude Code and Hermes sessions

## Adapter path

The intended integration path remains adapter-based:

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> LunaAgentOS unified JSON contract
  -> adapter host
  -> Runtime Session Model
  -> app rendering
```

This keeps the workspace neutral while allowing each runtime to preserve its own strengths.

## Current external entries

- **Claude Code**: validates real session output, long-form responses, and coding workflows
- **Hermes**: validates profile-based identity, Windows / WSL routing, ACP sessions, and richer runtime event visibility
- **Trae IDE**: represents the IDE-first bridge path

These are real external products entering the workspace. LunaAgentOS 0.2 Preview makes the workspace their shared host surface; each agent's own capabilities continue to come from those agents.

## Design constraints

The current product definition follows a few constraints:

- Lead with the neutral desktop workspace, then explain the supporting protocol
- Preserve runtime-native strengths instead of flattening everything into one chat surface
- Make process visibility a first-class part of the product
- Keep local history durable and recoverable
- Position 0.2 Preview as the workspace foundation on the road to a complete orchestration platform, without overstating the stage
- Grow the adapter contract before chasing marketplace or commercial-platform breadth

## Boundary for the next stage

The current repository already contains a working app and the first real integrations. The next layer builds on this foundation: harden runtime entries, make restore more reliable, clarify the adapter boundary, and design targeted session handoff — the next stretch of road on the way to an orchestration platform.
