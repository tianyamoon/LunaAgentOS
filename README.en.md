<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">LunaAgentOS</h1>

<p align="center">
  <a href="./README.md">中文说明</a>
</p>

**LunaAgentOS 0.2 Preview**

LunaAgentOS is a neutral desktop workspace for real AI agent sessions.

Today it is a Windows-first app for Claude Code and Hermes: choose a runtime entry, send real work into a live session, watch output, thought, and runtime events arrive, and return to the session from local history.

But that is only the first working slice. LunaAgentOS is aiming at a larger idea: a **Human Command Workspace** where the workspace adapts to the work, instead of forcing people to keep adapting themselves to every tool around it.

**Human commands. Agents execute. The workspace remembers.**

![LunaAgentOS desktop preview](./docs/assets/lunaagentos-stage1-preview.svg)

## Why it exists

AI agents are becoming powerful enough to do real work, but their sessions still disappear into separate tools:

- CLI, TUI, IDE, gateway, and SDK surfaces all expose different parts of the work.
- Thought, tool, plan, usage, output, and final response streams rarely live in one durable view.
- Session history is scattered, making restore, comparison, and review harder than the work itself.
- Multi-agent work creates configuration, memory, and tool duplication everywhere.

The problem is no longer just agent capability. The problem is that users still have to keep adapting themselves to every surface around the work.

LunaAgentOS is meant to reverse that burden: bring your existing agents, keep their native strengths, and get one workspace that helps you stay focused on the work instead of constantly re-learning tools, re-routing context, and stitching results back together.

## The product idea

LunaAgentOS is not trying to flatten every agent into one generic chatbot. It is trying to make real agent work feel less fragmented, less repetitive, and less tool-driven.

That idea has four pillars:

### 1. Human Command Workspace

The goal is not to give users one more panel to babysit. The goal is to let the workspace absorb tool boundaries so users can stay with the work:

- choose where the next task goes
- inject context deliberately
- watch processes stay visible
- step in for approval or correction
- collect outputs back into one workspace

### 2. A breathing workspace

Agents should not feel like static windows pinned forever on screen.

Over time, LunaAgentOS should make agent work feel alive:

- idle when nothing needs attention
- active when a task wakes them up
- prominent while work is unfolding
- folded and archived when the work is done

This "breathing" lifecycle is part of the product philosophy, not just a UI flourish.

### 3. A neutral desktop environment

LunaAgentOS should not absorb Claude Code, Hermes, Trae, or future runtimes into one built-in super-agent.

Instead, it should let users bring the agents they already trust, keep those agents recognizable, and stop paying the tax of re-learning a different surface every time the work crosses a tool boundary.

### 4. An OS layer above agent chaos

The long game is to reduce multi-agent pain from O(N) to O(1):

- configure shared capabilities once
- route tools through one desktop control point
- preserve reusable memory and context
- collect results without manual copy-paste glue

That is why LunaAgentOS ultimately wants to be more than a session viewer: it wants to remove the overhead around agent work, not add another layer of overhead on top of it.

## What you can do today

| Area | Status | Notes |
|---|---:|---|
| LunaAgentOS App | Working | Open a local Windows-first desktop workspace |
| Claude Code | Working | Send tasks into a real Claude Code runtime session |
| Hermes | Working | Use Windows / WSL ACP runtime instances and profiles |
| Trae IDE | Bridge path | Reserved IDE-first adapter direction |
| Runtime Session Cards | Working | See output, thought, runtime events, and final response together |
| Session Card event flow | Working | Render thought, tool, plan, usage, error, and related process signals as expandable event nodes |
| Focused workspace view | Working | Focus one session inside the workspace while keeping the input area available |
| Native slash command affordance | Working | Discover and insert native runtime commands exposed by agent entries |
| Provider identity | Working | Use provider icons and runtime identity to distinguish agent entries |
| Multi-session workspace | Working | Switch send target, keep live sessions, inspect archived sessions |
| Local history | Working | Restore JSON session history or open read-only archives |
| UI language | Working | zh-CN / en-US switch persisted locally |

## What comes next

The next stage is not a dramatic rebrand and not a sudden jump to full orchestration. It is the next credible layer of the same workspace: less time adapting to tools, more trust that the workspace can carry the work forward.

- harden Claude Code and Hermes runtime entry reliability
- make local history, restore, and archived transcripts easier to trust
- clarify adapter installation, capability boundaries, and future entry onboarding
- strengthen the Trae IDE bridge path without pretending it is already a mature runtime path
- introduce targeted session handoff, so selected context can move between entries or sessions when that behavior is truly implemented
- begin turning the workspace from "multiple visible sessions" into a more intentional human command surface

## The longer ambition

If LunaAgentOS succeeds, it should grow into something larger than a good desktop shell.

It should become a **neutral Agent Desktop Environment** and eventually an **operating layer for heterogeneous agent products**:

- different runtimes can be installed without being flattened
- runtime sessions can be observed, resumed, replayed, and governed
- task routing can happen between entries and sessions with explicit human control
- approvals, permissions, and result collection can live in one place
- shared configuration, tools, memory, and profiles can stop fragmenting across every agent setup

The endpoint is not "one more AI app."

The endpoint is a workspace where agent work becomes more legible, more governable, more durable, and less dependent on the quirks of whichever tool happened to start it.

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

LunaAgentOS 0.2 Preview is:

- A neutral desktop workspace for real AI agent sessions
- A Windows-first local app for Claude Code and Hermes sessions
- A workspace centered on Runtime Session Cards, event flow, and focused session views
- A session workspace with native agent commands and provider identity
- The first working slice of a Human Command Workspace
- A product surface backed by protocol, adapters, and the Runtime Session Model

LunaAgentOS 0.2 Preview is not:

- A single built-in agent that tries to absorb external runtimes
- A complete multi-agent orchestration platform
- A claim that every agent must look the same internally
- Team Mode, remote entry, or a complete shared memory bus
- A marketplace or broad commercial platform today

## Documentation

### Start here

- [Docs index](./docs/README.md)
- [0.2 Preview Release Notes](./docs/release-notes-0.2-preview.md)
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

- [Chinese README](./README.md)
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
