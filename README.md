# LunaAgentOS

[中文说明](./README_CN.md)

LunaAgentOS is a protocol-centered operating layer for heterogeneous coding agents.

Its foundation is a unified JSON contract, a Runtime Adapter / Plugin Contract, and a Runtime Session Model. The LunaAgentOS App is the concrete protocol console and the official recommended product experience: choose a target, send work into a real runtime, watch the process, and keep local session history in one place.

![LunaAgentOS desktop preview](./docs/assets/lunaagentos-stage1-preview.svg)

## Vision

Coding agents are becoming powerful, but the human workspace around them is still fragmented:

- **Entries are fragmented**: CLI, TUI, IDE, gateway, and SDK surfaces all coexist.
- **Process visibility is uneven**: some runtimes expose thought/tool/plan/usage streams, while others only show final output.
- **Session history is scattered**: useful work is hard to restore, compare, or review across tools.

LunaAgentOS focuses on the layer above those runtimes:

> Treat each external agent as a runtime entry, and make the session card the shared surface for output, thought stream, runtime stream, final response, and local history.

The long-term direction is an adapter-driven operating layer for heterogeneous agents: protocol and adapters define the operating contract, Runtime Session Model carries the work, and the App makes that contract usable.

## What works now

| Area | Status | Notes |
|---|---:|---|
| Product definition | Active | Protocol / Adapter Contract / Runtime Session Model |
| LunaAgentOS App | Working | Tauri 2 + Rust core + web workspace |
| Claude Code | Working | Real runtime entry |
| Hermes | Working | Windows / WSL ACP runtime instances and profiles |
| Trae IDE | Bridge | IDE-first adapter path |
| Runtime Session Cards | Working | Output, thought stream, runtime stream, final response |
| Multi-session workspace | Working | Current send target, current session, lifecycle-colored live and archived sessions |
| Local history | Working | JSON session history with restore/read-only states |
| Demo mode | Working | Non-persistent launch scene for screenshots and orientation |
| Runtime detection | Working | Provider/runtime-instance/target-profile probing |
| UI language | Working | zh-CN / en-US switch persisted locally |

## Quick start

### Requirements

- Windows
- Node.js
- Rust + MSVC toolchain
- Tauri 2 dependencies
- Claude Code installed if you want the Claude entry
- WSL + Hermes installed if you want the Hermes entry

Claude Code and Hermes are external runtimes. LunaAgentOS can open without them; unavailable entries stay visible with a clear configuration state.

### Run the LunaAgentOS App

```powershell
cd apps/desktop-shell
npm install
npm run tauri -- dev
```

### Build the lightweight executable

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

Executable path:

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

For details, see [Getting Started](./docs/getting-started.md).

## Demo mode

Open the app and click **演示场景** in the top bar. It loads a non-persistent scene showing:

- Claude Code and Hermes in the same workspace.
- Live Runtime Session Cards.
- Thought stream, runtime stream, Markdown output, and final response.
- A right-side session list split into live and archived sections.

The demo scene is for orientation and screenshots only. It does not write to real local history.

## Product boundaries

LunaAgentOS is:

- **A control layer** above existing agents.
- **A protocol and adapter contract** for heterogeneous runtime entries.
- **A runtime-session workspace** centered on durable session cards.
- **A concrete protocol console** for heterogeneous entries.
- **A path toward agent collaboration and a broader control plane.**

The App is the official recommended way to use LunaAgentOS today. New agent products enter through the adapter contract so the product experience stays coherent while each runtime keeps its native strengths.

## Documentation

- [Docs index](./docs/README.md)
- [Product definition](./docs/product-definition.md)
- [Getting Started](./docs/getting-started.md)
- [Current product boundary](./docs/current-boundary.md)
- [Why LunaAgentOS](./docs/why-lunaagentos.md)
- [Architecture overview](./docs/architecture-overview.md)
- [Roadmap](./docs/roadmap.md)
- [Protocol](./protocol/README.md)
- [Adapters](./adapters/README.md)
- [Apps](./apps/README.md)
- [Hermes ACP runtime](./docs/hermes-acp-profile-runtime.md)
- [Trae IDE bridge](./bridges/trae-ide/README.md)

## Contributing

The most useful contributions now are:

- Runtime hardening for Claude Code and Hermes.
- Hermes event UX: thought/tool/plan/usage stream presentation.
- Runtime Session Card usability.
- Local history, restore, and error-state validation.
- Trae IDE bridge design and integration.
- Documentation, screenshots, and release polish.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting.
