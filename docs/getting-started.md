# Getting Started

[中文](./getting-started.zh-CN.md)

This guide runs the current LunaAgentOS desktop app locally.

## What you should expect

After a successful local run, you should be able to:

- Open the Tauri desktop app
- See the left Agent Fleet, center Runtime Session workspace, and right session list
- Send real tasks to Claude Code or Hermes when those runtimes are installed locally

## Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 CLI dependencies
- Claude Code installed if you want the Claude entry
- WSL and Hermes installed if you want the Hermes entry

Claude Code and Hermes are external runtimes. LunaAgentOS can open without them; unavailable entries remain visible with a clear configuration state.

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

If neither runtime is installed, use the visible unavailable or unconfigured state to confirm that the app is detecting the missing runtime instead of relying on a demo path.

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
