# LunaAgentOS Adapters

Adapters are the extension boundary for bringing agent products into LunaAgentOS.

A LunaAgentOS adapter declares an agent product's runtime surfaces, targets, capabilities, and session behavior through the protocol manifest. The adapter implementation translates the native product surface into normalized Runtime Session events for the App.

## First-party adapters

- [`first-party/claude-code/`](./first-party/claude-code/) describes Claude Code.
- [`first-party/hermes/`](./first-party/hermes/) describes Hermes.
- [`first-party/trae-ide/`](./first-party/trae-ide/) describes the Trae IDE bridge direction.

## Adapter contract

The public contract starts in [`../protocol/`](../protocol/):

```text
adapter manifest -> adapter host -> Runtime Session Model -> App
```

## Legacy POC

[`legacy/stdio-poc/`](./legacy/stdio-poc/) preserves the early stdio proof of concept as historical material. New adapter work starts from the protocol schemas and first-party adapter manifests.
