# LunaAgentOS Architecture Overview

LunaAgentOS is a control layer above external coding-agent runtimes.

It does not rewrite the agents. It connects to them, observes their runtime sessions, normalizes their process visibility, and gives the developer one desktop workspace for active and archived work.

## Layers

```text
┌──────────────────────────────────────────────┐
│                Desktop Shell                 │
│        Tauri window / system integration      │
├──────────────────────────────────────────────┤
│                  UI Layer                    │
│   Agent Fleet / Session Cards / History       │
├──────────────────────────────────────────────┤
│                Runtime Core                  │
│   ACP sessions / process control / history    │
├──────────────────────────────────────────────┤
│              Runtime Surfaces                │
│      ACP / CLI / Gateway / IDE Bridge         │
├──────────────────────────────────────────────┤
│              External Runtimes               │
│        Claude Code / Hermes / Trae IDE        │
└──────────────────────────────────────────────┘
```

## Desktop Shell

The desktop shell provides:

- Native app window.
- Local runtime configuration.
- Local history storage.
- Bridge between the web workspace and Rust runtime commands.

Current stack:

- Tauri 2
- Rust core commands
- Lightweight web UI

## UI Layer

The UI is organized around three areas:

- **Left**: Agent Fleet and configuration.
- **Center**: active Runtime Session Cards.
- **Right**: live sessions and archived sessions.

The center workspace is the product core. A session card is responsible for output, thought stream, runtime/tool/plan/usage stream, final response, scrolling, copy, fullscreen, restore, and archive actions.

## Runtime Core

The Rust side owns runtime-facing responsibilities:

- Runtime availability probing.
- ACP process startup.
- Session prompt / load / resume / shutdown commands.
- Runtime event streaming into the frontend.
- Local JSON history read/write/archive/delete.
- Windows / WSL command routing.

## Runtime Surfaces

Different external agents expose different surfaces. LunaAgentOS treats these as runtime surfaces, not as product boundaries.

Current primary surface:

- **ACP / protocol** for structured runtime sessions and updates.

Important future surfaces:

- **PTY / terminal** for native CLI/TUI compatibility.
- **Gateway / messaging** for background and channel-based agents.
- **SDK** for official programmable runtimes.
- **IDE Bridge** for IDE-first products such as Trae IDE.

## External Runtimes

### Claude Code

Claude Code represents a high-value coding runtime. LunaAgentOS models it as one external entry that can own multiple sessions.

### Hermes

Hermes represents profile-based runtime entries and process visibility. Its ACP updates can expose thought, message, tool, plan, and usage events.

### Trae IDE

Trae IDE is a bridge target. LunaAgentOS keeps it visible as a future integration direction without pretending it is already a native runtime entry.

## Direction

The architecture is designed to stay light at the control layer and let external agents remain powerful at the runtime layer. The next architecture pressure will come from targetable call flow between entries and sessions.
