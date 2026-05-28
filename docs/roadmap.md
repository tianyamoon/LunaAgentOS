# Roadmap

[中文](./roadmap.zh-CN.md)

LunaAgentOS is heading toward a personal Agent operating system for the AI era. 0.2 Preview has laid down the first foundational stone on that road — a neutral desktop workspace for real AI agent sessions; the roadmap then advances stage by stage toward agent availability management, stronger Runtime Session behavior, clearer adapters, and targeted session handoff.

## Now: Product definition and Runtime Session workspace

The current focus is to make the product definition explicit while keeping Claude Code + Hermes credible inside the LunaAgentOS App:

- Protocol / Adapter Contract / Runtime Session Model as the architecture guide.
- Real external runtime entries.
- Current send target.
- Multi-session Runtime Session Cards.
- Output, thought, runtime, and final response surfaces.
- Local JSON history.
- Live / archived session lifecycle.
- Runtime detection and clear configuration states.

## Next: 0.3 agent availability and session cards

0.3 builds on the 0.2 workspace foundation and first hardens two basic layers, paving the way for later cross-agent collaboration:

- Agent availability management: identity, profile, models, capabilities, health state, repair guidance, and best practices.
- Session cards as task surfaces: task state, process layers, artifact summary, continue/retry/archive actions, and manual handoff.
- Continue making adapter manifest fields and capability metadata real, so agent management is not only UI copy.
- Keep the App as the protocol's concrete control console and official recommended use path.

See [0.3 Requirement Definition](./requirements-0.3.md) for the concrete scope.

## Then: Adapter contract seam and call flow

After agent availability and session cards are more reliable, the next architecture layer makes the adapter boundary and visible routing real:

- Treat Claude Code and Hermes as registry adapters with built-in extensions where needed.
- Keep Trae IDE on the IDE-first bridge path.
- Route new agent products through Adapter Contract.
- Select content from a session card.
- Send it to another runtime entry or another existing session.
- Preserve source, target, and task context.
- Make the call relationship visible in the workspace.

## Later: Collaboration workspace

After call flow exists, LunaAgentOS can grow a stronger collaboration model:

- Multiple entries working on related tasks.
- Clear target roles and capabilities.
- Human-readable routing decisions.
- Agent-initiated suggestions that still keep human control explicit.

## Longer term: Control plane

The long-term direction is an operating layer for heterogeneous agents:

- Provider and runtime management.
- Session replay, restore, and observation.
- Human approval flow.
- Task distribution.
- Runtime health and error-state handling.
- A stable extension model for more entries.

## Product principle

The roadmap stays incremental: first make the product definition and runtime workspace credible, then make the adapter contract real, then add call flow, collaboration, and broader control-plane capabilities.
