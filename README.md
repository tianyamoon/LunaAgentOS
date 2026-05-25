<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">LunaAgentOS</h1>

<p align="center">
  <a href="./README.zh-CN.md">中文说明</a>
</p>

**LunaAgentOS 0.1 Preview**

LunaAgentOS is a neutral desktop workspace for real AI agent sessions.

It is Windows-first and useful today with Claude Code and Hermes. Pick a runtime entry, send real work into a live session, watch output, thought, and runtime events arrive, and return to the session from local history.

It is not another chat shell. LunaAgentOS is the place where real agent processes stay visible, durable, and recoverable without pretending to replace the tools that run them.

![LunaAgentOS desktop preview](./docs/assets/lunaagentos-stage1-preview.svg)

## Why it exists

AI agents are becoming powerful enough to do real work, but their sessions still disappear into separate tools:

- CLI, TUI, IDE, gateway, and SDK surfaces all expose different parts of the work.
- Thought, tool, plan, usage, output, and final response streams rarely live in one durable view.
- Session history is scattered, making restore, comparison, and review harder than the work itself.

LunaAgentOS makes the session the product surface. Each external agent remains its own runtime entry; the desktop gives them a shared Runtime Session Card for output, thought, runtime events, final response, and local history.

## What you can do today

| Area | Status | Notes |
|---|---:|---|
| LunaAgentOS App | Working | Open a local Windows-first desktop workspace |
| Claude Code | Working | Send tasks into a real Claude Code runtime session |
| Hermes | Working | Use Windows / WSL ACP runtime instances and profiles |
| Trae IDE | Bridge path | Reserved IDE-first adapter direction |
| Runtime Session Cards | Working | See output, thought, runtime events, and final response together |
| Multi-session workspace | Working | Switch send target, keep live sessions, inspect archived sessions |
| Local history | Working | Restore JSON session history or open read-only archives |
| UI language | Working | zh-CN / en-US switch persisted locally |

## Quick start

### Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 dependencies
- Claude Code installed if you want the Claude entry
- WSL and Hermes installed if you want the Hermes entry

Claude Code and Hermes are the real runtime entries that make the workspace useful. LunaAgentOS can also open when those runtimes are not installed; each entry shows a clear configuration state rather than a crash or silent failure.

### Run the app

```powershell
cd apps/desktop-shell
npm install
npm run tauri -- dev
```

### Build a lightweight executable

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

Executable path:

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

More detail: [Getting Started](./docs/getting-started.md)

## Product boundary

LunaAgentOS 0.1 Preview is:

- A neutral desktop workspace for real AI agent sessions
- A Windows-first local app for Claude Code and Hermes sessions
- A Runtime Session workspace centered on durable session cards
- A product surface backed by protocol, adapters, and the Runtime Session Model

LunaAgentOS 0.1 Preview is not:

- A single built-in agent that tries to absorb external runtimes
- A complete multi-agent orchestration platform
- A claim that every agent must look the same internally
- A marketplace or broad commercial platform today

## Documentation

### Start here

- [Docs index](./docs/README.md)
- [0.1 Preview Release Notes](./docs/release-notes-0.1-preview.md)
- [Getting Started](./docs/getting-started.md)
- [Current Product Boundary](./docs/current-boundary.md)
- [Contributing](./CONTRIBUTING.md)

### Product and concepts

- [Product Definition](./docs/product-definition.md)
- [Why LunaAgentOS](./docs/why-lunaagentos.md)
- [Light-Core Principles](./docs/light-core-principles.md)
- [Roadmap](./docs/roadmap.md)

### Architecture and integration

- [Architecture Overview](./docs/architecture-overview.md)
- [Hermes ACP Runtime](./docs/hermes-acp-profile-runtime.md)
- [Hermes TUI Direction](./docs/hermes-tui-direction.md)
- [Protocol](./protocol/README.md)
- [Adapters](./adapters/README.md)
- [Core](./core/README.md)
- [Apps](./apps/README.md)
- [Trae IDE Bridge](./bridges/trae-ide/README.md)

### Community and policies

- [Security Policy](./SECURITY.md)
- [Trademark and Brand Guidelines](./TRADEMARKS.md)

### Chinese entry

- [Chinese README](./README.zh-CN.md)
- [Chinese docs index](./docs/README.zh-CN.md)

## License

This project is licensed under [Apache-2.0](./LICENSE).

## Contributing

The highest-value contributions right now are:

- Runtime hardening for Claude Code and Hermes
- Runtime Session Card usability and readability
- Hermes thought, tool, plan, and usage event UX
- Local history, restore, and error-state validation
- Trae IDE bridge design and integration
- Documentation, screenshots, and release polish

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting.
