# Getting Started

This guide runs the current LunaAgentOS desktop shell locally.

## What you can do

- Start the Tauri desktop shell.
- See the left Agent Fleet, center Runtime Session workspace, and right session list.
- Load the non-persistent demo scene from the top bar.
- Send real tasks to configured Claude Code / Hermes entries when local runtime dependencies are available.

## Requirements

- Windows
- Node.js
- Rust + MSVC toolchain
- Tauri 2 CLI dependencies
- Claude Code installed for the Claude entry
- WSL + Hermes installed for the Hermes entry

Claude Code and Hermes are external runtimes. LunaAgentOS can open without them; unavailable entries remain visible with a clear configuration state.

## Install frontend dependencies

```powershell
cd desktop-shell
npm install
```

## Run in development mode

```powershell
cd desktop-shell
npm run tauri -- dev
```

## Build the lightweight executable

```powershell
cd desktop-shell
npm run tauri -- build --no-bundle
```

Executable path:

```text
desktop-shell/src-tauri/target/release/desktop-shell.exe
```

The lightweight executable is the recommended local validation path. Full installer bundling can be added when distribution packaging becomes the priority.

## Use demo mode

1. Start the desktop shell.
2. Click `演示场景` in the top bar.
3. The workspace loads a controlled, non-persistent scene with Claude Code and Hermes session cards.
4. Click `清除演示` to return to the real workspace.

The demo scene is intended for orientation and screenshots. It does not write to real local history.

## Current product shape

- Claude Code and Hermes are the real runtime entries.
- Trae IDE is a bridge target, not an already-native runtime entry.
- The center workspace is organized around Runtime Session Cards.
- The right panel separates live sessions from archived sessions.
- Call flow between entries and sessions belongs to the next product layer.
