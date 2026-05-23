# Trae IDE Bridge Notes

Trae IDE is a future bridge target for LunaAgentOS.

## Product role

Trae represents the IDE-first entry type. LunaAgentOS keeps it visible because heterogeneous agent control should eventually cover CLI, TUI, gateway, SDK, and IDE surfaces.

## Current boundary

Trae IDE is not presented as a native runtime entry yet.

LunaAgentOS should not create a fake stdio adapter or fake manifest just to make the fleet look symmetrical. The integration should stay honest: Trae belongs to the bridge path until there is a real bridge surface.

## Bridge options

Potential bridge directions:

- IDE extension bridge
- Local helper process
- Terminal/session relay inside the IDE
- Desktop automation wrapper
- Structured session export/import path

## Rule

Keep Trae IDE as a real bridge target, not a simulated runtime.
