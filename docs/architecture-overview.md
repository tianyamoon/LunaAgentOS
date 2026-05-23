# LunaAgentOS Architecture Overview

LunaAgentOS is a protocol-centered control layer above external coding-agent runtimes.

It defines a unified adapter contract and Runtime Session Model, connects to external runtimes through adapters, observes their sessions, normalizes their process visibility, and lets the App render active and archived work.

## Layers

```text
┌──────────────────────────────────────────────┐
│               LunaAgentOS App                │
│        Protocol console and workspace         │
├──────────────────────────────────────────────┤
│             Runtime Session Model            │
│       Session / Turn / Event / History        │
├──────────────────────────────────────────────┤
│             Adapter Host / Core              │
│ Discovery / lifecycle / routing / approval    │
├──────────────────────────────────────────────┤
│         Runtime Adapter / Plugin Contract     │
│ Manifest / capabilities / normalized events   │
├──────────────────────────────────────────────┤
│              Runtime Surfaces                 │
│      ACP / CLI / Gateway / IDE Bridge         │
├──────────────────────────────────────────────┤
│              External Runtimes               │
│        Claude Code / Hermes / Trae IDE        │
└──────────────────────────────────────────────┘
```

## Protocol and adapter contract

The product center is the contract between LunaAgentOS and external agent products.

The contract should cover:

- Adapter manifest.
- Capability declaration.
- Runtime targets and profiles.
- Runtime sessions and turns.
- Normalized event stream.
- Tools, models, skills, MCP resources, permissions, routing metadata, and history.

Adding a new agent product follows the adapter path: manifest, adapter implementation, normalized runtime events, and App rendering.

## App

The App is the protocol's concrete control console and the official recommended way to use LunaAgentOS today.

The current app is [`apps/desktop-shell/`](../apps/desktop-shell/), which provides:

- Native Tauri window.
- Agent Fleet and configuration.
- Runtime Session Cards.
- Live sessions and archived sessions.
- Local history and restore actions.

The App renders normalized sessions and capabilities while adapters keep runtime-specific logic behind the protocol contract.

## Adapter Host / Core

The core layer owns runtime-facing responsibilities:

- Adapter discovery and lifecycle.
- Runtime availability probing through adapters.
- Runtime process startup.
- Session prompt / load / resume / shutdown commands.
- Normalized event streaming into apps.
- Local history read/write/archive/delete.
- Windows / WSL / remote command routing.

## Runtime Surfaces

Different external agents expose different surfaces. LunaAgentOS treats these as runtime surfaces behind adapters, not as product boundaries.

Current primary surface:

- **ACP / protocol** for structured runtime sessions and updates.

Important future surfaces:

- **PTY / terminal** for native CLI/TUI compatibility.
- **Gateway / messaging** for background and channel-based agents.
- **SDK** for official programmable runtimes.
- **IDE Bridge** for IDE-first products such as Trae IDE.

## First-party adapters

### Claude Code

Claude Code represents a high-value coding runtime. LunaAgentOS should model it as a first-party adapter and real external runtime entry.

### Hermes

Hermes represents profile-based runtime entries and process visibility. Its ACP updates can expose thought, message, tool, plan, and usage events. LunaAgentOS models it as a first-party adapter.

### Trae IDE

Trae IDE is a bridge target and future adapter direction. LunaAgentOS keeps it visible without pretending it is already a native runtime entry.

## Direction

The architecture keeps the control layer light and lets external agents remain powerful at the runtime layer. The next architecture work follows [Product Definition](./product-definition.md): protocol defines the contract, adapters connect external agent products, Runtime Session Model carries the work, and the App makes the system usable.
