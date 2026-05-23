# Why LunaAgentOS

## The problem

Coding agents are expanding into multiple product shapes:

- CLI agents
- TUI agents
- IDE agents
- gateway or service-style agents
- SDK-first programmable agents

Their capabilities keep improving, but the human workspace around them is still fragmented. Entry points, visibility, history, and routing are split across products.

## The project answer

LunaAgentOS answers that fragmentation with a control layer above the runtimes.

It aims to provide:

- A unified entry surface for heterogeneous agent products
- A shared adapter contract for runtime surfaces, targets, and capabilities
- A Runtime Session model that can hold output, thought, runtime events, final response, history, and restore state
- A desktop app that turns those ideas into a working workspace

## Why protocol matters

Without a stable protocol, every new integration becomes a custom UI path.

The protocol lets LunaAgentOS map different products into one operating model:

```text
agent product
  -> adapter manifest
  -> adapter implementation
  -> normalized Runtime Session events
  -> app workspace
```

That is the difference between a one-off integration and a system that can grow.

## Why first-party adapters matter

Claude Code and Hermes are the first practical tests of the model.

- Claude Code tests long-form coding output, markdown-heavy sessions, and resumable work
- Hermes tests WSL routing, ACP updates, profile identity, and high-visibility process events
- Trae IDE keeps the IDE-first bridge path honest

Together they force the contract to deal with real runtime behavior instead of idealized examples.

## What this project is trying to preserve

LunaAgentOS is not trying to erase the differences between products.

It is trying to preserve three things at once:

- The native strengths of each runtime
- A coherent workspace for the human operator
- A stable boundary for adding more agent products later

## Near-term direction

The near-term goal is not maximum breadth. It is credibility:

- keep the current app reliable
- improve the Runtime Session workspace
- make the adapter boundary more explicit
- strengthen local history and restore behavior
- make agent-to-agent routing visible when that layer lands

If that foundation is strong, LunaAgentOS can grow into a broader control plane without becoming another thin chat wrapper.
