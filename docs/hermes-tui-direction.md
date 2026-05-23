# Hermes TUI Direction

Hermes is valuable in LunaAgentOS because it can make runtime work feel alive, not just because it returns a final answer.

## Product direction

The right direction for Hermes is not simply “make it faster.”

The product goal is:

> Make slow work visible.

A Hermes session card should preserve the feeling of a live TUI while using the desktop workspace to improve readability, persistence, and control.

## What the card should show

The Hermes card should prioritize process visibility:

- Current profile / runtime identity
- Current task
- Running state
- Thought stream
- Runtime/tool/plan/usage stream
- Output stream
- Final response

The user should see “Hermes is working” instead of “the app is stuck.”

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

Hermes should not be forced to look exactly like Claude Code. LunaAgentOS should let each runtime keep its useful shape while normalizing the workspace around Runtime Session Cards.

For Hermes, that means:

- Process first, final answer second.
- Clear runtime state over silent waiting.
- Tool and plan events visible enough to be useful.
- Noise reduced without hiding the work.

## Next improvements

- Better event grouping and de-noising.
- Clearer plan/tool/usage presentation.
- Smoother long-running session visibility.
- Better restore/reconnect feedback for Hermes profiles.

## Summary

Hermes' value in LunaAgentOS is not just the result page. Its value is the live session.
