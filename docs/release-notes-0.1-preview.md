# LunaAgentOS 0.1 Preview Release Notes

LunaAgentOS 0.1 Preview is a neutral desktop workspace for real AI agent sessions.

This preview is intentionally small. It focuses on making real Claude Code and Hermes sessions visible, restorable, and easier to review in one Windows-first desktop workspace.

## What it is

- A Windows-first desktop workspace for real AI agent sessions.
- A local-first app centered on Runtime Session Cards.
- A neutral surface for external runtime entries rather than a replacement for those runtimes.
- A product experience backed by protocol, adapters, and the Runtime Session Model.

## What works today

- Claude Code can be used as a real runtime entry.
- Hermes can be used through Windows / WSL ACP runtime instances and profiles.
- Trae IDE is represented as an IDE-first bridge path.
- Runtime Session Cards show output, thought, runtime events, and final response in one surface.
- The workspace separates active sessions from archived sessions.
- Local JSON history stores session turns.
- Restore and read-only history states are available.
- The UI supports persisted zh-CN / en-US language switching.

## What is intentionally not in 0.1

- It is not an AionUi replacement.
- It is not a Claude Code or Hermes replacement.
- It is not a complete multi-agent orchestration platform.
- It is not a marketplace or broad commercial platform.
- It does not make every agent internally identical.
- It does not provide Team Mode.
- It does not expose remote entries as available 0.1 Preview features.
- It does not provide a shared memory bus across agents.
- It does not promise that arbitrary third-party adapters are production-ready.

## Who this preview is for

- Users who want a local desktop workspace for observing real AI agent sessions.
- Developers evaluating how Claude Code and Hermes sessions can be represented through shared session cards.
- Contributors who want to harden runtime entries, local history, restore behavior, and documentation before broader adapter or collaboration features are expanded.
- Integrators who want to understand the adapter direction without assuming LunaAgentOS is already a full orchestration platform.
