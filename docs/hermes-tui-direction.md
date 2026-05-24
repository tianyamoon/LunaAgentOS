# Hermes TUI Direction

[中文](./hermes-tui-direction.zh-CN.md)

Hermes is valuable in LunaAgentOS because it can make runtime work feel alive, not just because it returns a final answer.

## Product direction

Hermes in LunaAgentOS focuses on visible process, not final-only output.

The product goal is:

> Make slow work visible.

A Hermes session card preserves the feeling of a live TUI while using the desktop workspace to improve readability, persistence, and control.

## Card surface

The Hermes card prioritizes process visibility:

- Current profile / runtime identity
- Current task
- Running state
- Thought stream
- Runtime/tool/plan/usage stream
- Output stream
- Final response

The user sees “Hermes is working” instead of “the app is stuck.”

## Runtime event surface

Hermes ACP updates can map into LunaAgentOS card layers:

- `agent_thought_chunk`: thought stream
- `agent_message_chunk`: output stream
- `tool_call`: runtime stream
- `tool_call_update`: runtime stream
- `plan`: runtime plan update
- `usage_update`: runtime usage update

The desktop shell listens to runtime session updates and appends them to the matching session card.

## UI principle

Hermes keeps its useful runtime shape while LunaAgentOS normalizes the workspace around Runtime Session Cards.

For Hermes, that means:

- Process first, final answer second.
- Visible runtime state over silent gaps.
- Tool and plan events visible enough to be useful.
- Noise reduced without hiding the work.

## Next improvements

- Better event grouping and de-noising.
- Clearer plan/tool/usage presentation.
- Smoother long-running session visibility.
- Better restore/reconnect feedback for Hermes profiles.

## Summary

Hermes' value in LunaAgentOS is the live session: visible process, runtime state, and final result in one Runtime Session Card.
