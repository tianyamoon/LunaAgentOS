# Product Definition

LunaAgentOS is a protocol-centered control layer for heterogeneous coding-agent runtimes.

The current LunaAgentOS app is the concrete product surface for that layer: choose a target, send work into a real runtime session, observe the process, and keep local history in one place.

## The product shape

LunaAgentOS is built from four pieces that reinforce each other:

- **Unified JSON contract**: stable public shapes for adapter identity, runtime sessions, runtime events, capabilities, and history
- **Runtime Adapter / Plugin Contract**: the integration boundary for external agent products
- **Runtime Session Model**: the shared session, turn, lifecycle, and history model that apps can render consistently
- **LunaAgentOS App**: the desktop workspace that turns the contract into an actual product experience

## Why the app matters

The app is not a separate side project around the protocol. It is the reference product experience for the protocol.

Today the app provides:

- A native desktop window
- Agent Fleet and runtime configuration
- Runtime Session Cards
- Live and archived sessions
- Local history, restore actions, and read-only history states

The protocol defines the contract. The app proves that the contract is usable.

## The adapter path

New agent products should enter LunaAgentOS through the adapter boundary:

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> LunaAgentOS unified JSON contract
  -> adapter host
  -> Runtime Session Model
  -> app rendering
```

This keeps the product experience coherent while allowing each runtime to preserve its own strengths.

## Runtime surfaces

Different products expose different runtime surfaces. LunaAgentOS treats those as adapter concerns rather than product boundaries.

Current primary surface:

- **ACP / protocol** for structured runtime sessions and updates

Planned or possible surfaces:

- **PTY / terminal** for native CLI and TUI compatibility
- **SDK streaming** for official programmable runtimes
- **Gateway / HTTP / WebSocket** for remote or background agents
- **IDE Bridge** for IDE-first products

## First-party adapters

The first-party adapters exist to validate and sharpen the contract:

- **Claude Code** proves high-value coding workflows and long-form output handling
- **Hermes** proves profile-based identity, Windows / WSL routing, and rich runtime event visibility
- **Trae IDE** represents the IDE-first bridge path

These are not fake demo entries. They are real external products entering the system through the same model LunaAgentOS wants to scale.

## Design constraints

The current product definition follows a few constraints:

- Keep the control layer light
- Preserve runtime-native strengths instead of flattening everything into one chat surface
- Make process visibility a first-class part of the product
- Keep local history durable and recoverable
- Grow the adapter contract before chasing marketplace or platform breadth

## Boundary for the next stage

The current repository already contains a working app and the first real integrations. The next stage is not to rename the idea again; it is to make the adapter boundary clearer, the runtime workspace stronger, and the protocol easier to extend.
