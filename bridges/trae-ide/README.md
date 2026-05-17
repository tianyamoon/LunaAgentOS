# Trae IDE Bridge Notes

`Trae IDE` is part of the first LunaAgentOS product wedge because it fills the `free` position in the `strongest / general / free` trio.

It is not represented as a native Phase 0 CLI manifest here on purpose.

## Reason

The current POC protocol focuses on `stdio_json` and `stdio_text` CLI runtimes. Trae IDE is strategically important, but its public surface is IDE-first rather than cleanly CLI-first.

## Bridge options to explore later

- desktop automation wrapper
- IDE extension bridge
- terminal interception inside the IDE
- session relay through a local helper process

## Current rule

Do not create a fake `stdio` manifest for Trae IDE just to make the matrix look symmetrical. Keep it as a real bridge target.
