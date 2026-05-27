# LunaAgentOS 0.2 Preview Release Notes

[中文](./release-notes-0.2-preview.zh-CN.md)

LunaAgentOS 0.2 Preview keeps the same product direction: make real agent sessions clearer, more controllable, and less disruptive inside a desktop workspace.

This release is not a broad expansion of scope. It turns the 0.1 working slice into a more product-like workspace: process visibility is stronger, focused single-session work feels better, runtime identity is clearer, and native agent commands can be discovered and inserted from the workspace.

## Highlights

- **Session Card event flow**: thought, tool, plan, usage, error, and related process signals are rendered as structured event nodes. They expand during streaming and fold back after completion, preserving process without keeping the whole workspace noisy.
- **Focused workspace view**: the old fullscreen overlay is replaced by an in-workspace focus mode, so users can focus on one session while the bottom input area remains visible and usable.
- **Native agent command affordance**: slash command support lets the workspace discover and insert native commands exposed by runtime entries.
- **Provider identity**: provider icons and runtime identity make Claude Code, Hermes, and future entries easier to distinguish in the workspace.
- **Clearer multi-session surface**: Session Card headers, status counts, task descriptions, and action groups are reorganized so current work and historical sessions stay easier to read.

## Still included

- Windows-first local desktop workspace.
- Claude Code and Hermes real runtime entries.
- Runtime Session Cards for output, thought, runtime events, and final response.
- Separate live sessions and archived sessions.
- Local JSON session history, restore, and read-only archive views.
- Persisted zh-CN / en-US UI language switching.
- Trae IDE bridge reserved as a later IDE-first path.

## Intentionally not in this preview

- It is not a complete multi-agent auto-collaboration system.
- It is not a complete orchestration platform.
- It does not provide Team Mode.
- It does not present remote entries as available features.
- It does not promise a complete shared memory bus.
- It does not flatten every external runtime into one internal agent shape.
- It does not make marketplace or broad commercial-platform work a 0.2 release goal.

## Who should try it

- Users already running Claude Code or Hermes who want a clearer local workspace around those sessions.
- Developers who want to observe real agent process, not only final answers.
- Contributors interested in adapters, runtime sessions, process visibility, history, and restore behavior.
- People following the longer Human Command Workspace direction for LunaAgentOS.

For setup details, see [Getting Started](./getting-started.md).
