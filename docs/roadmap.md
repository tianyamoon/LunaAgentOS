# Roadmap

LunaAgentOS is growing from a working protocol console into a protocol-centered adapter layer, Runtime Session Model, collaboration workspace, and broader control plane.

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

## Next: Adapter contract seam

The next architecture layer makes the adapter boundary real:

- Define adapter manifest fields and capability metadata.
- Treat Claude Code and Hermes as registry adapters with built-in extensions where needed.
- Keep Trae IDE on the IDE-first bridge path.
- Route new agent products through Adapter Contract.
- Keep the App as the protocol's concrete control console and official recommended use path.

## Then: Call flow between sessions and entries

The next layer is visible routing:

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
