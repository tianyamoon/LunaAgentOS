# LunaAgentOS 0.1 Preview Release Notes

[中文](./release-notes-0.1-preview.zh-CN.md)

LunaAgentOS 0.1 Preview is a Windows-first neutral desktop workspace for real AI agent sessions.

This release is about one concrete workflow: choose Claude Code or Hermes, run a real session, watch the process unfold in a Runtime Session Card, and keep the result in local history for restore or review.

The scope is intentionally small. LunaAgentOS 0.1 Preview is useful today as a local session workspace, not as a complete orchestration platform.

## What it is

- A Windows-first desktop workspace for real AI agent sessions.
- A local-first app centered on durable Runtime Session Cards.
- A shared session surface for Claude Code and Hermes runtime entries.
- A neutral companion to external runtimes, not a replacement for them.

## What works today

The core value is the real runtime workflow: send work to real runtimes, keep the process visible, and preserve the session locally.

- **Claude Code real runtime entry**: send tasks into a live Claude Code session and watch output, thought, and runtime events arrive.
- **Hermes real runtime entry**: use Windows / WSL ACP runtime instances and profiles, with thought, tool, plan, and usage events flowing into the same card surface.
- **Runtime Session Cards**: keep output stream, thought stream, runtime events, and final response together across multiple turns.
- **Local history**: store session turns in local JSON.
- **Restore / archive**: restore sessions from local history or open them as read-only archived transcripts.
- **Session list**: separate live sessions from archived sessions so current work and past work remain distinct.
- **Language switching**: persisted zh-CN / en-US UI language selection.
- **Trae IDE bridge direction**: represented as an IDE-first bridge path, not a primary runtime workflow in 0.1.

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

- Users who already run Claude Code or Hermes and want a clearer desktop workspace around those sessions.
- Developers evaluating how real agent runtimes can be represented through shared session cards without hiding their process.
- Contributors who want to harden runtime entries, local history, restore behavior, and documentation before broader adapter or collaboration features are expanded.
- Integrators who want to understand the adapter direction while respecting the current 0.1 boundary.

For setup details, see [Getting Started](./getting-started.md).
