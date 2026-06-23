<p align="center">
  <img src="./docs/assets/logo2.png" alt="LunaAgentOS" width="560" />
</p>

<h1 align="center">The Personal Desktop Operating System for the AI Era</h1>

<p align="center">
  Bring scattered agent work back into one personal operating environment.
</p>

<p align="center">
  <a href="./README.md">中文说明</a>
</p>

**LunaAgentOS 0.3.0**

LunaAgentOS is a personal desktop operating environment built for multi-agent work and collaboration.

It brings agent tools such as Claude Code, Hermes, and OpenAI Codex into one desktop entry point, so you can start tasks, inspect process, switch sessions, and recover history in one place instead of carrying context between separate tools.

**Humans command. Agents execute. The workspace remembers.**

![LunaAgentOS desktop preview](./docs/assets/lunaagentos-stage1-preview.svg)

## The New Problem of Agent Work

AI agents have started to carry real work, but a new problem has appeared: people are no longer talking to one tool. They are making decisions across multiple agents, sessions, and execution processes.

A single agent can finish a task. Several agents together create a new kind of work overhead:

- who took the task, who is still running, and who already produced a result
- which process details are worth keeping, and which context can continue in another agent
- which result is final, and which one is only intermediate material
- when a human needs to confirm something, and when execution can continue

There is also a more practical burden: accounts, subscriptions, API keys, model quotas, and trial periods keep multiplying. Which one is still valid, which one expired, which one is still costing money, and which one has been abandoned should not depend on memory.

LunaAgentOS is not trying to create one more agent. It is trying to give multi-agent work a desktop environment that humans can command, observe, hand off, collect, and govern, so both work and resources waste less.

## The Product Idea

LunaAgentOS is not trying to flatten every agent into one generic chatbot. It is trying to make real agent work less fragmented, less repetitive, and less tool-driven.

That idea has four pillars:

### 1. Human Command Workspace

The goal is not to give users one more control panel to babysit. The goal is to let the workspace absorb tool boundaries so people can keep their attention on the work itself:

- decide where the next task goes
- inject context deliberately
- keep the execution process visible
- step in for approval or correction when needed
- collect results back into one workspace

### 2. A Breathing Workspace

Agents should not feel like a contact list permanently pinned to the screen.

Over time, LunaAgentOS should make agent work feel like it can move in and out of the stage:

- quiet when nothing needs attention
- awakened when there is a task
- prominent while execution is underway
- folded back into history when the work is done

### 3. A Neutral Agent Desktop Environment

LunaAgentOS is not absorbing Claude Code, Hermes, Trae, or future runtimes into one built-in super-agent.

It lets users bring the agents they already trust, keeps those agents recognizable and native, and removes the tax of adapting to a new surface every time work crosses tool boundaries.

### 4. An OS Layer Above Agent Chaos

The longer goal is to compress the O(N) pain of multi-agent work into O(1):

- configure shared capabilities once
- route tools through one desktop control point
- preserve reusable memory and context
- collect results without manual copy-paste glue

That is why LunaAgentOS ultimately does not want to be only a session viewer. It wants to reduce the overhead around agent work instead of adding another layer of overhead.

## What You Can Do Today

| Area | Status | Notes |
|---|---:|---|
| LunaAgentOS App | Working | Open a local Windows-first desktop workspace |
| Claude Code | Working | Send tasks into a real Claude Code runtime session |
| Hermes | Working | Use Windows / WSL ACP runtime instances and profiles |
| OpenAI Codex | Working | Identify and host Codex through a manifest-backed adapter |
| Runtime Session Card | Working | See output, thought, runtime events, and final response together |
| Session Card event flow | Working | Render thought, tool, plan, usage, error, and related process signals as expandable event nodes |
| Focus view | Working | Focus a single session inside the workspace while keeping the input area available |
| Native agent command entry | Working | Discover and insert native runtime commands through slash commands |
| Provider identity | Working | Use provider icons and runtime identity to distinguish agent entries |
| Multi-session workspace | Working | Switch send target, keep live sessions, and inspect archived sessions |
| Local history | Working | Restore JSON session history or open read-only archives |
| UI language | Working | Persist zh-CN / en-US switching locally |

## What Changed

- Process is clearer: thought, tool calls, and runtime state no longer scatter across surfaces
- Single-session work is more focused: after entering Focus, the input area remains available
- Multi-session work is easier to manage: current sessions, history, and archived sessions are separated more clearly
- Agent identity is easier to recognize: entries from different providers have clearer visual identity
- Common commands are easier to reach: native agent commands can be invoked quickly from the input area

## What Comes Next

The next stage is no longer just placing multiple agents in one interface. It is about letting LunaAgentOS become the management layer for personal agent work.

The workspace can already host Claude Code, Hermes, and OpenAI Codex. It can show process, focus sessions, and separate history from archives. The next more important step is to make these entries, sessions, accounts, models, and resources manageable, transferable, and governable.

- **Manage agent assets in one place**: bring providers, runtimes, accounts, API keys, model quotas, subscription cycles, and trial states together so users know what still works, what is expiring, and what has been abandoned.
- **Reduce invisible waste**: identify duplicate capabilities, idle entries, expired configuration, and keys that still consume budget, so cost no longer depends on memory.
- **Let work continue across agents**: one agent's process, context, and result should be handed to another agent under human confirmation instead of manual copy-paste.
- **Make collaboration relationships visible**: who took the task, who is running, who needs more information, and who produced the final result should all leave clear relationships in the workspace.
- **Make entry health more trustworthy**: do more than show whether a runtime is available; explain configuration gaps, error states, recovery paths, and capability boundaries.
- **Turn the workspace into a personal control surface**: move from "choose an agent and send a task" toward "manage my agent capabilities, budget, sessions, history, and collaboration flows."

## The Longer Ambition

In the long run, LunaAgentOS should not stop at being a convenient desktop shell.

The shell is only the first entry point. The deeper order to protect is the working order between a person and a set of different agent products: a **neutral, observable, recoverable, and governable Agent Desktop Environment** that can keep growing into an **operating layer for heterogeneous agent products**.

That operating layer should not get coherence by forcing every runtime into the same internal model. It should assume that Claude Code, Hermes, Trae, and future agent products keep their own runtime shape, permission boundaries, interaction habits, and release rhythms. LunaAgentOS should form a stable working environment above them:

- different runtimes can be connected without being flattened into one internal structure
- runtime sessions become work objects that can be observed, resumed, replayed, audited, and governed
- task routing between entries and sessions happens under explicit human control, not through an opaque takeover
- multiple agents can collaborate around the same piece of work: one agent's process, context, and result can become material for another agent to continue with human confirmation
- approvals, permissions, process evidence, and result collection can live in one trusted place
- shared configuration, tools, memory, profiles, and work preferences stop fragmenting across every agent setup
- people can understand, in one desktop environment, who is doing what, why it is happening, how far it got, and whether it can continue

It is a new kind of working environment: agent work becomes less trapped in scattered tool windows, temporary context hauling, and product-specific quirks, and becomes more visible, more governable, more durable, and more worthy of long-term human trust and control.

## Quick Start

### Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 dependencies
- Claude Code installed if you want the Claude entry
- WSL and Hermes installed if you want the Hermes entry

Claude Code, Hermes, and OpenAI Codex are the runtime entries that make the workspace valuable. LunaAgentOS can also open when they are not installed; each entry shows a clear configuration state rather than a crash or silent failure.

### Run the App

```powershell
cd apps/desktop-shell
npm install
npm run tauri dev
```

### Build a Lightweight Executable

```powershell
cd apps/desktop-shell
npm run tauri build -- --no-bundle
```

Executable path:

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

More detail: [Getting Started](./docs/getting-started.md)

## Product Boundary

LunaAgentOS 0.3.0 is:

- A neutral desktop workspace for real AI agent sessions
- A Windows-first local app for Claude Code, Hermes, and OpenAI Codex sessions
- A workspace centered on Runtime Session Cards, event flow, and Focus view
- A session workspace with native agent commands and provider identity
- The first working slice of a Human Command Workspace
- A product surface backed by protocol, adapters, and the Runtime Session Model

LunaAgentOS 0.3.0 is not:

- A product that absorbs external runtimes into one built-in agent
- A complete multi-agent orchestration platform
- A claim that every agent must look the same internally
- Team Mode, remote entry, or a complete shared memory bus
- A marketplace or broad commercial platform today

## Documentation

### Start Here

- [Docs index](./docs/README.md)
- [0.3.0 Release Notes](./docs/release-notes-0.3.md)
- [Getting Started](./docs/getting-started.md)
- [Current Product Boundary](./docs/current-boundary.md)
- [Contributing](./CONTRIBUTING.md)

### Product and Concepts

- [Product Definition](./docs/product-definition.md)
- [Why LunaAgentOS](./docs/why-lunaagentos.md)
- [Light-Core Principles](./docs/light-core-principles.md)
- [Roadmap](./docs/roadmap.md)

### Architecture and Integration

- [Architecture Overview](./docs/architecture-overview.md)
- [Hermes ACP Runtime](./docs/hermes-acp-profile-runtime.md)
- [Hermes TUI Direction](./docs/hermes-tui-direction.md)
- [Protocol](./protocol/README.md)
- [Adapters](./adapters/README.md)
- [Core](./core/README.md)
- [Apps](./apps/README.md)
- [Trae IDE Bridge](./bridges/trae-ide/README.md)

### Community and Policies

- [Security Policy](./SECURITY.md)
- [Trademark and Brand Guidelines](./TRADEMARKS.md)

### Chinese Entry

- [Chinese README](./README.md)
- [Chinese docs index](./docs/README.zh-CN.md)

## Author

Li Bai

## Community

QQ Group: 687805974

## License

This project is licensed under [Apache-2.0](./LICENSE).

## Contributing

The highest-value contribution areas right now are:

- Claude Code / Hermes runtime reliability
- Runtime Session Card usability and readability
- Hermes thought / tool / plan / usage event experience
- Local history, restore, and error-state validation
- Trae IDE bridge design and integration
- Documentation, screenshots, and release materials

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting.
