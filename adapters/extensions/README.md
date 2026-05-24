# Adapter Extensions

This directory contains built-in runtime extension code for adapters whose behavior cannot be fully described by manifest fields.

Manifest-only adapters do not need code here. Start with `adapters/registry/<adapter-id>/manifest.json` and add an extension only when the manifest is not enough.

Use an extension for:

- OS-specific runtime probing
- custom launch specs
- Windows / WSL routing
- dynamic runtime targets
- profile discovery

## Built-in extensions

Built-in extensions live in `builtin/` and are selected by the manifest `extension` field.

```json
{
  "extension": "builtin.hermes"
}
```

The extension ID is registered in `builtin/mod.rs` and implemented in a sibling Rust module.

Reference implementations:

- `builtin/claude.rs`: simple CLI runtime probe and launch logic.
- `builtin/hermes.rs`: runtime target/profile discovery plus launch logic.

The desktop shell is currently the only adapter host. It imports this directory through `apps/desktop-shell/src-tauri/src/adapter_extensions.rs`.
