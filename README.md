# LunaAgentOS

[中文说明](./README_CN.md)

LunaAgentOS is a desktop control console for heterogeneous coding agents.

It does not try to replace Claude Code, Hermes, or future IDE agents. It sits above them as a neutral workspace: choose the current target, send work into a real runtime, watch the process, and keep session history in one place.

![LunaAgentOS Stage 1 preview](./docs/assets/lunaagentos-stage1-preview.svg)

## Why this exists

Modern coding agents are powerful, but they are fragmented:

- **Different entries**: CLI, TUI, IDE, gateway-based agents.
- **Different visibility**: some stream thoughts/tools, some only show final output.
- **Different history**: sessions are hard to compare, restore, or archive across tools.

LunaAgentOS starts with a small claim:

> Treat each external agent as a runtime entry, and make the session card the shared surface for output, thought stream, runtime stream, final response, and local history.

## Current stage

`Stage 1` means **minimal heterogeneous desktop console**.

It is not the final agent operating system yet. It is the first credible slice:

- **Claude Code** is a real entry.
- **Hermes** is a real entry through Windows / WSL / ACP runtime instances.
- **Trae IDE** is reserved as a bridge target, not falsely presented as already integrated.
- **Runtime Session Cards** are the center of the product.
- **Local JSON history** preserves session transcripts.
- **Live sessions** and **archived sessions** are separated in the right panel.
- **Runtime availability** is probed at startup per provider/runtime instance, so the app can launch even when Claude Code or Hermes is not installed yet.
- **Chinese / English UI switching** is available from the top bar, including dynamic provider, session-card, history, code-block, and report-view labels.

## What is working now

| Area | Status | Notes |
|---|---:|---|
| Desktop shell | Working | Tauri 2 + Rust core + web UI |
| Claude Code entry | Working | Real runtime path |
| Hermes entry | Working | Windows / WSL ACP runtime instances and profiles |
| Trae IDE | Planned | Bridge route only |
| Multi-session workspace | Working | Session cards, current session, current send target |
| Process visibility | Working | Thought/runtime/final response surfaces |
| Local history | Working | JSON session history, restore/read-only states |
| Screenshot/demo mode | Working | In-app launch demo scene for GitHub screenshots |
| Runtime detection | Working | Startup probes distinguish provider, runtime instance, and send target/profile |
| UI language | Working | zh-CN / en-US switch persisted locally, covering static and dynamic workspace labels |

## Quick start

### Requirements

- Windows
- Node.js
- Rust + MSVC toolchain
- Tauri 2 dependencies
- Claude Code installed if you want the Claude entry
- WSL + Hermes installed if you want the Hermes entry

Claude Code and Hermes are external runtimes. LunaAgentOS can start without them; unavailable entries are shown as **Not configured** or **Unavailable** until you configure or install the runtime.

### Configure runtimes

Use the **Connection** button in the Agent Fleet to open connection details and recheck local runtime availability.

The left fleet is organized as provider -> runtime instance -> target/profile:

- Claude Code can expose separate Windows and WSL runtime instances.
- Hermes can expose separate Windows and WSL runtime instances.
- Hermes profiles are shown under the runtime instance that reported them.
- If a machine has no usable runtime, the entry remains visible with a clear not-connected state.

The legacy prompt-based runtime configuration is kept as a fallback from the connection dialog.

Settings are stored in the app-local `runtime-config.json`, not in the repository.

### Run the desktop shell

```powershell
cd desktop-shell
npm install
npm run tauri -- dev
```

### Build the lightweight release executable

```powershell
cd desktop-shell
npm run tauri -- build --no-bundle
```

The current verified artifact path is:

```text
desktop-shell/src-tauri/target/release/desktop-shell.exe
```

For more details, see [Getting Started](./docs/getting-started.md).

## Demo / screenshot mode

The desktop shell now includes a controlled launch demo scene.

Open the app and click **演示场景** in the top bar. It loads a non-persistent scene showing:

- Claude Code and Hermes in the same workspace.
- Two live Runtime Session Cards.
- Thought stream, runtime stream, Markdown output, and final response.
- A right-side session list split into live and archived sections.

The demo scene is for screenshots only and does not write to real runtime history.

## Product boundaries

LunaAgentOS is:

- **A control layer** above existing agents.
- **A runtime session workspace**, not a normal chatbot UI.
- **A neutral console** for heterogeneous entries.
- **An incremental path** toward delegation, collaboration, and a control plane.

LunaAgentOS is not:

- A replacement for Claude Code, Hermes, or Trae.
- A fake multi-agent demo made from internal roles.
- A plugin market or commercial platform yet.
- A Stage 2 orchestration system yet.

## Documentation

- [Chinese README](./README_CN.md)
- [Getting Started](./docs/getting-started.md)
- [Docs index](./docs/README.md)
- [Why LunaAgentOS](./docs/why-lunaagentos.md)
- [Architecture overview](./docs/architecture-overview.md)
- [Stage 1 alignment](./docs/prompt-v1-alignment.md)
- [Hermes ACP runtime](./docs/hermes-acp-profile-runtime.md)
- [Trae IDE bridge notes](./bridges/trae-ide/README.md)

## Roadmap

- **Stage 1**: minimal heterogeneous console with Claude Code + Hermes.
- **Stage 2**: call flows between entries.
- **Stage 3**: richer collaboration workspace.
- **Stage 4**: broader control plane.

These are internal progression stages, not public release numbers.

## Contributing

The most useful contributions now are:

- Runtime hardening for Claude Code and Hermes.
- Hermes event UX: thought/tool/plan/usage stream presentation.
- Desktop shell UI polish around Runtime Session Cards.
- Trae IDE bridge research.
- Docs, screenshots, and validation reports.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before starting.
