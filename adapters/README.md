# LunaAgentOS Adapters

Adapters are the extension boundary for bringing agent products into LunaAgentOS.

A LunaAgentOS adapter declares an agent product's runtime surfaces, targets, capabilities, and session behavior through the protocol manifest. The adapter implementation translates the native product surface into normalized Runtime Session events for the App.

## First-party adapters

- [`first-party/claude-code/`](./first-party/claude-code/) describes Claude Code.
- [`first-party/hermes/`](./first-party/hermes/) describes Hermes.
- [`first-party/trae-ide/`](./first-party/trae-ide/) describes the Trae IDE bridge adapter.

## Adapter contract

The public contract starts in [`../protocol/`](../protocol/):

```text
adapter manifest -> adapter host -> Runtime Session Model -> App
```

## Stdio adapter reference

[`reference/stdio/`](./reference/stdio/) contains stdio adapter reference files for manifest loading, process lifecycle, stream handling, and normalized event translation. New adapter work starts from the protocol schemas and first-party adapter manifests.
