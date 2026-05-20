# Getting Started

This guide is for running the current Stage 1 desktop shell locally.

## What you can verify

- Start the Tauri desktop shell.
- See the left Agent Fleet, center Runtime Session workspace, and right session list.
- Load the non-persistent launch demo scene from the top bar.
- Send real tasks to configured Claude Code / Hermes entries when your local runtime dependencies are available.

## Requirements

- Windows
- Node.js
- Rust + MSVC toolchain
- Tauri 2 CLI dependencies
- Claude Code installed for the Claude entry
- WSL + Hermes installed for the Hermes entry

Hermes is expected to be reachable from Windows through WSL. The current Hermes path is ACP-oriented, so one-shot fallback behavior should only be used for smoke tests, not treated as the full RuntimeSession path.

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

## Build the lightweight release executable

```powershell
cd desktop-shell
npm run tauri -- build --no-bundle
```

Current verified artifact:

```text
desktop-shell/src-tauri/target/release/desktop-shell.exe
```

Full installer bundling is not the primary Stage 1 verification path yet. Prefer `--no-bundle` while the project is still validating the lightweight desktop shell.

## Use launch demo mode

1. Start the desktop shell.
2. Click `演示场景` in the top bar.
3. The workspace loads a controlled, non-persistent scene with Claude Code and Hermes session cards.
4. Click `清除演示` to return to the real workspace.

The demo scene is intended for README screenshots and does not write to real local history.

## Current boundaries

- Claude Code and Hermes are the Stage 1 real entries.
- Trae IDE is a bridge target, not an already-native runtime entry.
- The center workspace is organized around Runtime Session Cards.
- The right panel separates live sessions from archived sessions.
- Stage 2 orchestration / call flow is planned, not implemented here.
