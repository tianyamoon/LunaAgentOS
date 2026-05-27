# LunaAgentOS Docs

[中文](./README.zh-CN.md)

This directory is the public documentation entry point for LunaAgentOS.

If you are new here, start with the docs that answer three practical questions first:

- What is LunaAgentOS today?
- How do I run it locally?
- Where can I contribute safely?

## Start here

- [Getting Started](./getting-started.md): install dependencies, run the desktop app, and validate the current workspace
- [0.2 Preview Release Notes](./release-notes-0.2-preview.md): new capabilities, retained boundaries, and who this preview is for
- [Current Product Boundary](./current-boundary.md): what LunaAgentOS is, what it is not, and what is intentionally out of scope today
- [Contributing](../CONTRIBUTING.md): development setup, tests, contribution areas, and pull request expectations

## Product and concepts

- [Product Definition](./product-definition.md): the product shape, core building blocks, and adapter path
- [Why LunaAgentOS](./why-lunaagentos.md): the problem this project is trying to solve
- [Light-Core Principles](./light-core-principles.md): the constraints that keep the control layer focused
- [Roadmap](./roadmap.md): near-term and longer-term direction

## Architecture and integration

- [Architecture Overview](./architecture-overview.md): current layering and responsibilities
- [Hermes ACP Runtime](./hermes-acp-profile-runtime.md): Hermes runtime semantics and profile loading
- [Hermes TUI Direction](./hermes-tui-direction.md): visibility goals for live sessions
- [Protocol](../protocol/README.md): schemas, examples, and the public contract
- [Adapters](../adapters/README.md): adapter registry and built-in extension boundary
- [Core](../core/README.md): adapter host, runtime session, and capability model
- [Apps](../apps/README.md): product surfaces built on the protocol
- [Trae IDE Bridge](../bridges/trae-ide/README.md): the IDE-first bridge path

## Community and policies

- [Security Policy](../SECURITY.md): how to report security-sensitive issues
- [Trademark and Brand Guidelines](../TRADEMARKS.md): code license and brand usage boundaries

## Chinese entry

- [Chinese docs index](./README.zh-CN.md)
- [Getting Started (Chinese)](./getting-started.zh-CN.md)
- [Current Product Boundary (Chinese)](./current-boundary.zh-CN.md)
- [Product Definition (Chinese)](./product-definition.zh-CN.md)
- [Why LunaAgentOS (Chinese)](./why-lunaagentos.zh-CN.md)
- [Light-Core Principles (Chinese)](./light-core-principles.zh-CN.md)
- [Roadmap (Chinese)](./roadmap.zh-CN.md)
- [Architecture Overview (Chinese)](./architecture-overview.zh-CN.md)
- [Hermes ACP Runtime (Chinese)](./hermes-acp-profile-runtime.zh-CN.md)
- [Hermes TUI Direction (Chinese)](./hermes-tui-direction.zh-CN.md)

## Code entry points

- [`protocol/`](../protocol/): adapter manifest, Runtime Session, and Runtime Event contracts
- [`core/`](../core/): adapter host, runtime session, and capability model
- [`adapters/`](../adapters/): plugin manifests, built-in adapter extensions, and integration boundary
- [`apps/`](../apps/): product surfaces built on the protocol
- [`bridges/`](../bridges/): bridge paths for IDE-first integrations
