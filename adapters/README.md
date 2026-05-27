# LunaAgentOS Adapters

Adapters are split into plugin descriptions and optional built-in runtime extension code.

```text
adapters/registry   = adapter manifests and runtime capability facts
adapters/extensions = built-in runtime extension code when a manifest is not enough
```

## Directory roles

`adapters/registry/<adapter-id>/manifest.json` is the source of truth for adapter facts that can be declared as data:

- runtime identity (`id`, `name`, `extension`)
- transport and launch command
- process execution permissions
- runtime capabilities
- native slash commands exposed through `capabilities.slashCommands`

`adapters/extensions/` is for adapter behavior that cannot be represented as manifest data:

- OS-specific runtime probing
- Windows / WSL routing
- custom launch specs
- dynamic runtime targets
- profile discovery

The desktop shell must consume adapter facts from these manifests and extensions. It should not hardcode runtime-specific command lists or capability facts in UI code.

## Add an adapter

Start with a manifest:

```text
adapters/registry/<adapter-id>/manifest.json
```

If the adapter can be described by a command, transport, permissions, and capabilities, stop there.

Use [`registry/codex/manifest.json`](./registry/codex/manifest.json) as the manifest-only example.

Declare native slash commands in the manifest:

```json
{
  "capabilities": {
    "slashCommands": [
      { "name": "status", "descriptionKey": "composer.command.status" }
    ]
  }
}
```

The shell uses this list for command search, frequency sorting, and command insertion only. It does not parse or execute the command itself.

Use an adapter extension for commands that are discovered at runtime rather than declared as stable manifest facts:

- profile-local skills
- user or project custom slash commands
- plugin-contributed commands
- commands that depend on runtime/session state

Dynamic commands are returned through the adapter host's runtime slash-command discovery path and merged with manifest commands by the shell. The shell still treats the result as presentation data; the runtime remains responsible for interpreting the inserted slash command.

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
