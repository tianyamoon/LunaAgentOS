# LunaAgentOS Adapters

Adapters are split into plugin descriptions and optional built-in runtime extension code.

```text
adapters/registry   = plugin manifest files scanned by the desktop app
adapters/extensions = runtime extension code when a manifest is not enough
```

## Add an adapter

Start with a manifest:

```text
adapters/registry/<adapter-id>/manifest.json
```

If the adapter can be described by a command, transport, permissions, and capabilities, stop there.

Use [`registry/codex/manifest.json`](./registry/codex/manifest.json) as the manifest-only example.

## Add a built-in extension

Add extension code only when the adapter needs custom runtime behavior such as:

- OS-specific runtime probing
- Windows / WSL routing
- custom launch arguments
- dynamic runtime targets or profile discovery

Then add:

```text
adapters/extensions/builtin/<adapter-id>.rs
```

and register the extension in:

```text
adapters/extensions/builtin/mod.rs
```

Use these references:

- [`registry/claude-code/manifest.json`](./registry/claude-code/manifest.json) + [`extensions/builtin/claude.rs`](./extensions/builtin/claude.rs): simple CLI probe and launch logic.
- [`registry/hermes/manifest.json`](./registry/hermes/manifest.json) + [`extensions/builtin/hermes.rs`](./extensions/builtin/hermes.rs): profile and runtime target discovery.

## Runtime host

The desktop shell is the current adapter host. It loads manifests from `adapters/registry` and bridges built-in extension code from `adapters/extensions`.

Relevant host code:

- `apps/desktop-shell/src-tauri/src/adapter_registry.rs`
- `apps/desktop-shell/src-tauri/src/adapter_extensions.rs`
- `apps/desktop-shell/src-tauri/src/acp_runtime.rs`
