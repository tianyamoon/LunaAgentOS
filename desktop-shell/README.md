# LunaAgentOS Desktop Shell

This directory contains the LunaAgentOS desktop reference application.

## Role

The desktop shell consumes the protocol/core layer and provides:

- A native Tauri window.
- The Agent Fleet, Runtime Session workspace, and session list UI.
- Runtime configuration and availability checks.
- Rust commands for ACP sessions, process routing, and local JSON history.

## Stack

- Tauri 2
- Rust core commands
- Lightweight web UI
- Local JSON history

## Run locally

### Development mode

```powershell
npm run tauri -- dev
```

### Lightweight executable

```powershell
npm run tauri -- build --no-bundle
```

Executable path:

```text
src-tauri/target/release/desktop-shell.exe
```

### Helper scripts

The Windows helper scripts are kept for convenience:

- `run-tauri-dev.cmd`
- `run-tauri-build-nobundle.cmd`
- `run-tauri-build.cmd`

## Product principle

The desktop shell should stay light and should not become the product center:

- Fast to open.
- Low overhead around heavy external agents.
- Runtime state visible.
- Session cards as the center of the workspace.
- No fake internal agents just to make the UI look fuller.
- No adapter model that only exists as internal UI configuration.
