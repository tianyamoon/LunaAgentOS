# Current Product Boundary

LunaAgentOS is currently a lightweight desktop workspace for heterogeneous coding-agent runtime sessions.

## What LunaAgentOS is

- **A control layer above existing agents**: it connects to external runtimes instead of replacing them.
- **A Runtime Session workspace**: the central object is a session card, not a chat bubble list.
- **A neutral console**: Claude Code, Hermes, and future IDE agents are modeled as external entries.
- **A local-first desktop shell**: runtime visibility and session history stay close to the developer workstation.

## What works now

- Claude Code can be used as a real runtime entry.
- Hermes can be used through Windows / WSL ACP runtime instances and profiles.
- The left side shows the Agent Fleet and current send target.
- The center workspace shows active Runtime Session Cards.
- Each card can hold output stream, thought stream, runtime stream, and final response.
- The right side separates live sessions from archived sessions.
- Local JSON history stores session turns and supports restore/read-only states.
- Demo mode shows the intended Claude + Hermes workspace without writing real history.

## What LunaAgentOS is not

- It is not a replacement for Claude Code, Hermes, or Trae IDE.
- It is not a fake multi-agent system made from internal roles.
- It is not a normal chatbot container.
- It is not a full orchestration platform yet.
- It is not a plugin market or commercial platform.

## Modeling rules

### External entries

The left fleet represents external entry objects:

- Claude Code
- Hermes
- Trae IDE bridge target

Claude internal subagents or delegation workers are treated as Claude's own internal mechanism, not as independent LunaAgentOS entries.

### Current send target

The current send target only answers: “where does the next user input go by default?”

It does not mean the whole system has only one agent, and it does not replace the active session workspace.

### Runtime Session Cards

A session card is the shared surface for:

- User task
- Runtime output
- Thought stream
- Runtime/tool/plan/usage stream
- Final response
- Local history and restore state

## Next direction

The next product layer is not “more fake agents.” It is targetable collaboration:

- Send selected session content to another entry.
- Send selected content to another existing session.
- Show the relationship between source session and target session.
- Keep human control visible while agents collaborate.
