# LunaAgentOS 0.2.1 Release Notes

[中文](./release-notes-0.2.1.zh-CN.md)

LunaAgentOS 0.2.1 moves the product expression from "a real agent session workspace" toward "the personal desktop operating system for the AI era." It still starts from real sessions, process visibility, and local history, but it now points more clearly toward multi-agent work, resource governance, and a personal control surface.

This release is not a broad feature expansion. It is a positioning, entry-point, and local-run polish release.

## Highlights

- **Product positioning upgrade**: the Chinese README and app topbar now use "AI 时代的个人桌面操作系统," aligning the product with a personal operating environment, multi-agent collaboration, and resource governance.
- **English README aligned with the Chinese source**: the English README now follows the Chinese structure and adds the new problem of agent work, account / API key / model quota management, the next-stage direction, and the longer ambition.
- **OpenAI Codex Manifest promoted into current entry messaging**: the README now describes Claude Code, Hermes, and OpenAI Codex Manifest together as current multi-provider agent entries.
- **Next stage repositioned**: the roadmap language moves from "strengthen the workspace basics" toward a personal agent management layer covering agent assets, budget waste, cross-agent continuation, collaboration relationships, and entry health.
- **Local app startup command corrected**: docs now use `npm run tauri dev` for the desktop app and `npm run tauri build -- --no-bundle` for lightweight executable builds.

## Still-Valid Foundation

- Windows-first local desktop workspace.
- Claude Code, Hermes, and OpenAI Codex Manifest entry messaging.
- Runtime Session Card surfaces for output, thought, runtime events, and final response.
- Session Card event flow, Focus view, native agent command entry, and provider identity.
- Separation between live sessions, history sessions, and archived sessions.
- Local JSON session history, restore, and read-only archive open.
- zh-CN / en-US UI language switching persisted locally.

## What This Release Does Not Claim

- It is not a complete automatic multi-agent collaboration system.
- It is not a complete orchestration platform.
- It does not provide Team Mode.
- It does not promise a complete shared memory bus.
- It does not flatten every external runtime into one internal agent.
- It does not make marketplace or broad commercial-platform work a 0.2.1 release goal.

## Who Should Try It

- People already using Claude Code, Hermes, or Codex who want a more unified local workspace.
- People with multiple agent accounts, subscriptions, API keys, or model quotas who care about long-term management cost.
- Developers who want to observe real agent process instead of only final answers.
- Contributors interested in adapters, runtime sessions, process visibility, history restore, and the agent control-plane direction.

Installation and run details: [Getting Started](./getting-started.md).
