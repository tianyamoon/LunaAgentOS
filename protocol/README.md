# LunaAgentOS Protocol

LunaAgentOS defines a protocol-first operating layer for heterogeneous coding agents.

The protocol gives every agent product the same public contract:

- Adapter identity and manifest metadata.
- Runtime surfaces and command capabilities.
- Runtime targets, instances, and profiles.
- Runtime sessions, turns, lifecycle, and history.
- Normalized runtime events for output, thought, tool, plan, usage, state, and errors.
- Shared capability slots for tools, models, skills, MCP resources, permissions, and routing.

The App is the protocol's concrete control console and the official recommended way to use LunaAgentOS today. The App renders the normalized state; the protocol defines how heterogeneous agents enter the system.

## Public contract

The current contract starts with three schemas:

- [`schemas/adapter-manifest.schema.json`](./schemas/adapter-manifest.schema.json)
- [`schemas/runtime-session.schema.json`](./schemas/runtime-session.schema.json)
- [`schemas/runtime-event.schema.json`](./schemas/runtime-event.schema.json)

The examples show how first-party adapters describe real products:

- [`examples/adapter-manifest.claude-code.json`](./examples/adapter-manifest.claude-code.json)
- [`examples/adapter-manifest.hermes.json`](./examples/adapter-manifest.hermes.json)

## Integration path

A new agent product enters LunaAgentOS through this path:

```text
agent product -> adapter manifest -> adapter implementation -> adapter host -> Runtime Session Model -> App
```

This keeps the App experience coherent while allowing each agent to preserve its native strengths.
