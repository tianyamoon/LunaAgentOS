# Roadmap

LunaAgentOS is growing from a working desktop reference app toward a protocol-centered adapter layer, Runtime Session Model, collaboration workspace, and broader control plane.

## Now: Product definition and Runtime Session workspace

The current focus is to make the product definition explicit while keeping Claude Code + Hermes credible inside one desktop workspace:

- Protocol / Adapter Contract / Runtime Session Model as the architecture guide.
- Real external runtime entries.
- Current send target.
- Multi-session Runtime Session Cards.
- Output, thought, runtime, and final response surfaces.
- Local JSON history.
- Live / archived session lifecycle.
- Runtime detection and clear configuration states.

## Next: Adapter contract seam

The next architecture layer is not adding more hard-coded providers. It is making the adapter boundary real:

- Define adapter manifest fields and capability metadata.
- Treat Claude Code and Hermes as first-party adapters.
- Keep Trae IDE as a bridge target and future adapter.
- Move toward adding new agent products without changing core/app code.
- Keep the desktop shell as a reference app that consumes normalized protocol state.

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
