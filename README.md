# LunaAgentOS

[中文说明](./README_CN.md)

LunaAgentOS aims to become an operating system for heterogeneous agents.

It is not another base agent. It sits above existing CLI, IDE, and gateway-based agent products, giving them a shared entry point, workspace, and control layer.

The first step is modest: unify entry points and preserve sessions in one desktop workspace. From there, it can grow into delegation flows, collaboration flows, and a broader control plane.

## Current Phase

The project is currently in `Stage 1 - minimal heterogeneous desktop console`.

Stage 1 does not aim for complex orchestration yet. It first proves one core workflow:

> A user can stop jumping between separate agent entry points, choose the current target in one desktop workspace, send a task, observe the process, and keep local session history.

The key boundaries are:

- At least two real entries must work: `Claude Code` and `Hermes`.
- The left panel is the entry fleet and configuration area, not the main workspace switcher.
- Entries are real external targets, not manually created placeholder agents.
- The center is a session workspace, where each card carries one session's process and result.
- The right panel is local session history.
- The current stage stabilizes the main send target before expanding into complex multi-agent orchestration.

## Current Entries

- **Claude Code**: the high-capability entry.
- **Hermes**: the general entry and process-visibility sample.
- **Trae IDE**: the free entry, reserved for future bridge integration.

## Desktop Shell

The desktop shell has moved beyond a static prototype. Users can set the current send target, start sessions, view session cards, and see local history on the right.

## Documentation

- `README_CN.md`: full Chinese documentation
- `docs/README.md`: product, architecture, runtime, and validation docs index
- `docs/prompt-v1-alignment.md`: Stage 1 boundary and handoff alignment
- `docs/hermes-acp-profile-runtime.md`: Hermes integration technical notes
- `bridges/trae-ide/README.md`: Trae IDE bridge notes

## Current Verification Target

- Real desktop shell.
- Main-agent multi-session workspace.
- Local JSON session history.
- Real runtime paths for Claude Code and Hermes.
- Hermes process events stream into session cards.
- Composer keeps send as the dominant action, with secondary preferences tucked underneath it.
- Selected entries, active sessions, and active history items share one warm accent style.
- The current send target, current session, and live-session registry are separate state concepts.
- The middle session card is being refined as the RuntimeSession surface: TUI-like process visibility plus comfortable Markdown reading for Claude Code and Hermes.
- Session cards support jump-to-latest, copy-response, copy-turn-transcript, copy-session-transcript, expand/collapse flows, and remembered thought/runtime detail expansion.
- Multi-turn session cards support latest-only/all-turns mode so long conversations can focus on the newest turn while copied transcripts still keep the full context.
- Markdown rendering now covers common agent output shapes including links, strikethrough, blockquotes, horizontal rules, ordered lists, task lists, table alignment, and copyable code blocks.
- Running session cards show a live breathing state, streaming/latest anchors, and thought/runtime event counts.
- Table reading is improved with sticky headers and row hover, while live/waiting animations respect reduced-motion preferences.
- Session cards are keyboard-focusable; `Enter` / `Space` activates the current session with a clear focus-visible style.
- Session card fullscreen reading has a modal-like backdrop and supports `Esc` to exit quickly.
- Current-session, latest-only, and fullscreen states expose `aria-*` markers, highlighted toggle buttons, and semantic labels for better keyboard and assistive-technology readability.

For full Chinese documentation, see [README_CN.md](./README_CN.md).
