# Trae IDE Bridge

Trae IDE is the IDE-first bridge target for LunaAgentOS.

## Product role

Trae represents the IDE-first entry type. LunaAgentOS keeps IDE-native workflows inside the same adapter and Runtime Session model used for CLI, TUI, gateway, and SDK surfaces.

## Current boundary

Trae IDE is the bridge target for the IDE-first adapter path.

The integration follows the bridge path: IDE surface, adapter manifest, adapter host, normalized Runtime Session events, and App rendering.

## Bridge surfaces

Bridge implementation can use:

- IDE extension bridge
- Local helper process
- Terminal/session relay inside the IDE
- Desktop automation wrapper
- Structured session export/import path

## Product rule

Trae IDE remains a real IDE bridge entry in the Agent Fleet and follows the same adapter contract as other runtime entries.
