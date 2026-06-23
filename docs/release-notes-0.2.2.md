# LunaAgentOS 0.2.2 Release Notes

[中文](./release-notes-0.2.2.zh-CN.md)

LunaAgentOS 0.2.2 is a small bugfix release focused on provider icon asset paths and production bundling, while continuing to move icon identity into adapter manifests.

## Fixes and Improvements

- **Fix provider icons in production builds**: provider icons now use stable public/runtime asset paths so Vite production builds do not lose or mis-reference static icon assets.
- **Keep icon identity with adapter manifests**: Claude Code, Codex, Hermes, Trae, and related entries now carry icon metadata closer to their adapter registry definitions.
- **Support manifest-driven adapter icons**: manifest-backed providers can expose their own icon assets, reducing frontend hard-coded icon mapping.
- **Add 0.3 requirements docs**: new 0.3 direction documents outline agent asset management, collaboration flow, and control-plane capabilities.

## Still-Valid Foundation

- Windows-first local desktop workspace.
- Claude Code, Hermes, and OpenAI Codex entry messaging.
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
- It does not make marketplace or broad commercial-platform work a 0.2.2 release goal.

Installation and run details: [Getting Started](./getting-started.md).
