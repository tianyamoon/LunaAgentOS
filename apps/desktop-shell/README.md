# LunaAgentOS App

This directory contains the LunaAgentOS App: the protocol's concrete control console and the official recommended way to use LunaAgentOS today.

## Role

The App consumes the protocol/core layer and provides:

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
npm run tauri dev
```

### Lightweight executable

```powershell
npm run tauri build -- --no-bundle
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

The App stays light around heavy external agents:

- Fast to open.
- Low overhead around heavy external agents.
- Runtime state visible.
- Session cards as the center of the workspace.
- External entries remain real products.
- Adapter capabilities enter the product through the protocol contract.
