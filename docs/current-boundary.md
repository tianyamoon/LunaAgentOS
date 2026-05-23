# Current Product Boundary

LunaAgentOS is a protocol-centered control layer with a working App for heterogeneous coding-agent runtime sessions.

## What LunaAgentOS is

- **A control layer above existing agents**: it connects to external runtimes and keeps their native strengths visible.
- **A Runtime Adapter / Plugin contract direction**: new agent products enter through adapters and normalized runtime events.
- **A Runtime Session workspace**: the central object is a session card, not a chat bubble list.
- **A neutral console**: Claude Code, Hermes, and future IDE agents are modeled as external entries.
- **A local-first App**: the App is the protocol's concrete control console and official recommended use path.

## What works now

- Claude Code can be used as a real runtime entry.
- Hermes can be used through Windows / WSL ACP runtime instances and profiles.
- The left side shows the Agent Fleet and current send target.
- The center workspace shows active Runtime Session Cards.
- Each card can hold output stream, thought stream, runtime stream, and final response.
- The right side separates live sessions from archived sessions.
- Local JSON history stores session turns and supports restore/read-only states.
- Demo mode shows the intended Claude + Hermes workspace without writing real history.
- The product definition now treats protocol, adapters, and Runtime Session Model as the architecture guide for future refactors.

## Current scope

- LunaAgentOS controls and observes external runtimes through adapters.
- LunaAgentOS keeps Claude Code, Hermes, and Trae IDE as external product entries.
- LunaAgentOS organizes work around Runtime Session Cards.
- LunaAgentOS grows adapter capability, runtime routing, and collaboration flow before marketplace or commercial-platform features.

## Modeling rules

### External entries

The left fleet represents external entry objects:

- Claude Code
- Hermes
- Trae IDE bridge target

Claude internal subagents or delegation workers remain part of Claude's own internal mechanism.

### Adapter boundary

Claude Code and Hermes are first-party adapters that validate the contract.

The long-term rule is:

```text
new agent product -> adapter manifest + adapter implementation -> LunaAgentOS unified JSON contract
```

Adding a new agent product follows adapter/plugin installation and normalized Runtime Session events.

### Current send target

The current send target answers: “where does the next user input go by default?”

The active session workspace remains the center of multi-session work.

### Runtime Session Cards

A session card is the shared surface for:

- User task
- Runtime output
- Thought stream
- Runtime/tool/plan/usage stream
- Final response
- Local history and restore state

## Next direction

The next product layer is targetable collaboration:

- Send selected session content to another entry.
- Send selected content to another existing session.
- Show the relationship between source session and target session.
- Keep human control visible while agents collaborate.
