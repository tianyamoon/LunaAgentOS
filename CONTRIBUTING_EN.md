# Contributing

LunaAgentOS is building a protocol-centered control layer for heterogeneous coding-agent runtimes. The most useful contributions right now make the current runtime entries more reliable, strengthen the Runtime Session workspace, and make the adapter contract clearer.

## Before you start

Please align on these assumptions first:

1. LunaAgentOS is a control layer above external agents, not a replacement agent runtime.
2. The current priority is to make Claude Code, Hermes, and the Runtime Session workspace trustworthy.
3. The repository is still evolving quickly, so naming, docs, and boundaries will continue to tighten.

## Local development

### Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 dependencies

Optional runtimes:

- Claude Code for validating the Claude entry
- WSL and Hermes for validating the Hermes entry

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

### Run tests

```powershell
cd apps/desktop-shell
npm run test:all
```

Useful targeted checks:

- `npm run test:runtime`
- `npm run test:history`
- `npm run test:providers`
- `npm run test:markdown`
- `npm run lint:undef`

If your change affects a specific area, run the focused tests for that area at minimum. If your change crosses multiple workflows, prefer `npm run test:all`.

## High-value contribution areas

- runtime hardening for Claude Code and Hermes
- Runtime Session Card usability and readability
- Hermes thought, tool, plan, and usage event hierarchy
- local history, restore, delete, and error-state validation
- Trae IDE bridge design and integration
- adapter contract and runtime-surface convergence
- documentation, screenshots, demos, and release polish

## Project judgment

Prefer these decisions:

- keep protocol changes explicit
- keep runtime-specific logic at the adapter edge
- keep the workspace centered on Runtime Sessions
- treat external entries as real products, not decorative shells
- keep the control layer light and honest about current scope

Avoid these shortcuts:

- rushing to integrate many agents at once
- burying protocol decisions inside app-only code
- rebuilding runtime-native behavior inside the control layer
- expanding into platform breadth before the contract is stable

## Issues and pull requests

For issues, include:

- the entry involved: Claude Code / Hermes / Trae IDE / other
- your environment: Windows, WSL, versions, and relevant runtime details
- expected behavior
- actual behavior
- whether the problem is reproducible

For pull requests, please explain:

- what problem the change solves
- why this approach fits LunaAgentOS
- which workflows or entries are affected
- what validation you ran
- screenshots or recordings for UI changes when helpful
