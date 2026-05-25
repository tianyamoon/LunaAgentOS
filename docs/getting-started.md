# Getting Started

[中文](./getting-started.zh-CN.md)

This guide runs the current LunaAgentOS desktop app locally.

## What you should expect

After a successful local run, you should be able to:

- Send real tasks to Claude Code or Hermes and watch output, thought, and runtime events arrive in a Runtime Session Card
- See the left Agent Fleet, center Runtime Session workspace, and right session list
- Open the app without those runtimes installed and see each entry in a clear configuration state

## Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 CLI dependencies
- Claude Code installed if you want the Claude entry
- WSL and Hermes installed if you want the Hermes entry

Claude Code and Hermes are the real runtime entries that make the workspace useful. LunaAgentOS can also open when they are not installed; each entry shows a clear configuration state rather than a crash or silent failure.

## Install frontend dependencies

```powershell
cd apps/desktop-shell
npm install
```

## Run in development mode

```powershell
cd apps/desktop-shell
npm run tauri -- dev
```

## Build a lightweight executable

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

Executable path:

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

The lightweight executable is the recommended local validation path. Full installer bundling can be added later when packaging becomes a higher priority.

## Validate the current workspace

When the app opens, check for these surfaces:

- Left: Agent Fleet and configuration state
- Center: Runtime Session workspace
- Right: live sessions and archived sessions

If Claude Code or Hermes is missing, the entry should still appear with a clear unavailable or unconfigured state.

## Validate with a real runtime session

1. Start the LunaAgentOS app.
2. Select Claude Code or Hermes in the Agent Fleet.
3. Send a small real task from the composer.
4. Confirm that the Runtime Session Card shows output, runtime activity, and the final response.
5. Confirm that the session appears in the session list and can be restored from local history.

If neither runtime is installed, confirm that each entry shows a clear configuration or unavailable state. This is the expected explainable state, not a crash or error.

## Optional validation commands

The current desktop app exposes focused test scripts:

```powershell
cd apps/desktop-shell
npm run test:all
```

You can also run targeted checks such as `npm run test:runtime`, `npm run test:history`, or `npm run lint:undef`.

## Current product shape

- Claude Code and Hermes are the real runtime entries today
- Trae IDE is the bridge target for the IDE-first adapter path
- The center workspace is organized around Runtime Session Cards
- The right panel separates live sessions from archived sessions
- Call flow between entries and sessions belongs to the next product layer
