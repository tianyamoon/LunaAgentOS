# Contributing

[中文](./CONTRIBUTING.zh-CN.md)

LunaAgentOS 0.1 Preview is a neutral desktop workspace for real AI agent sessions. Contributions are most useful when they make the current runtime entries more reliable, improve the Runtime Session workspace, or clarify the adapter contract.

## Before you start

Please align on these project boundaries before opening an issue or pull request:

1. LunaAgentOS is a neutral workspace around external agents, not a replacement agent runtime.
2. Claude Code, Hermes, and the Runtime Session workspace are the current reliability focus.
3. Runtime-specific behavior should stay near adapters unless the protocol needs a shared concept.
4. The repository is still evolving quickly, so names, docs, and boundaries may continue to tighten.

## Set up a local workspace

### Requirements

- Windows
- Node.js
- Rust with the MSVC toolchain
- Tauri 2 dependencies

Optional runtime dependencies:

- Claude Code, if you want to validate the Claude entry
- WSL and Hermes, if you want to validate the Hermes entry

### Install dependencies

```powershell
cd apps/desktop-shell
npm install
```

### Run the desktop app

```powershell
cd apps/desktop-shell
npm run tauri -- dev
```

### Build a lightweight executable

```powershell
cd apps/desktop-shell
npm run tauri -- build --no-bundle
```

The executable is expected under:

```text
apps/desktop-shell/src-tauri/target/release/desktop-shell.exe
```

## Validate your change

Run the narrowest checks that cover your change, then use the broader checks when a change crosses workflows.

### Full check

```powershell
cd apps/desktop-shell
npm run test:all
```

### Focused checks

```powershell
cd apps/desktop-shell
npm run test:runtime
npm run test:history
npm run test:providers
npm run test:markdown
npm run lint:undef
```

Useful mapping:

- Runtime event or adapter-surface changes: `npm run test:runtime`
- History, restore, archive, or payload changes: `npm run test:history`
- Provider or runtime target state changes: `npm run test:providers`
- Markdown rendering or normalization changes: `npm run test:markdown`
- Cross-cutting UI or state changes: `npm run test:all`

If you cannot run a relevant check, say so in the pull request and explain why.

## High-value contribution areas

- Runtime hardening for Claude Code and Hermes
- Runtime Session Card usability and readability
- Hermes thought, tool, plan, and usage event hierarchy
- Local history, restore, delete, and error-state validation
- Trae IDE bridge design and integration
- Adapter contract and runtime-surface convergence
- Documentation, screenshots, demos, and release polish

## Project judgment

Prefer changes that:

- keep protocol decisions explicit
- keep runtime-specific logic at the adapter edge
- keep the workspace centered on Runtime Sessions
- treat external entries as real products, not decorative shells
- keep the control layer light and honest about current scope

Avoid changes that:

- rush to integrate many agents at once
- bury protocol decisions inside app-only code
- rebuild runtime-native behavior inside the control layer
- expand into platform breadth before the contract is stable
- add product claims that the current implementation cannot support

## Issues

When opening an issue, include:

- the entry involved: Claude Code / Hermes / Trae IDE / other
- your environment: Windows, WSL, relevant runtime versions, and important configuration details
- expected behavior
- actual behavior
- whether the problem is reproducible
- logs, screenshots, or recordings when they help, with secrets removed

Do not include secrets, tokens, private repository data, or exploit details in a public issue. Use [SECURITY.md](./SECURITY.md) for security-sensitive reports.

## Pull requests

Before opening a pull request:

1. Keep the change focused on one problem.
2. Update docs when behavior, commands, public paths, or product boundaries change.
3. Run the relevant validation commands.
4. Add screenshots or recordings for visible UI changes when helpful.
5. Make sure new public docs follow the bilingual path convention when applicable.

In the pull request description, explain:

- what problem the change solves
- why this approach fits LunaAgentOS
- which workflows or runtime entries are affected
- what validation you ran
- any known limitations or follow-up work

If the change touches protocol, naming, or product boundary, describe the judgment explicitly instead of only listing implementation details.

## Documentation language

Public documentation uses this convention:

- English primary path: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `TRADEMARKS.md`, `docs/foo.md`
- Simplified Chinese path: `README.zh-CN.md`, `CONTRIBUTING.zh-CN.md`, `SECURITY.zh-CN.md`, `TRADEMARKS.zh-CN.md`, `docs/foo.zh-CN.md`
- `LICENSE` stays as the single English license file.

When adding or changing public docs, keep English and Chinese pages factually equivalent. Natural translation is fine; changing product claims between languages is not.

## Legal and security notes

- Code is licensed under [Apache-2.0](./LICENSE).
- Trademark and brand usage are described in [TRADEMARKS.md](./TRADEMARKS.md).
- Security-sensitive reports should follow [SECURITY.md](./SECURITY.md).
