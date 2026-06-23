# LunaAgentOS 0.3.0 Release Notes

[中文](./release-notes-0.3.zh-CN.md)

LunaAgentOS 0.3.0 tightens two foundation capabilities on top of the runtime session workspace: **Agent management** (identity, profile, model, capabilities, safety, best practices) and a first evidence-backed pass at **health diagnostics**. The release keeps Runtime Session and Task strictly separated — Task, Handoff, and orchestration remain later phases.

See [0.3 Requirements](./requirements-0.3.md) for the full scope definition.

## Agent Management

- **Agent identity and runtime detail**: each Agent surfaces its name, provider, profile, runtime environment, runtime command, and default working directory; account identity is shown only when the runtime or adapter can provide it.
- **Model control honesty**: adapters that support LunaAgentOS-managed defaults let you pick and save the default model for new Runtime Sessions; other agents are explicitly shown as runtime-managed, and an in-session `/model` is not treated as a persistent default.
- **Capability matrix**: files, commands, network, images, browser, and local-repo capabilities are presented per Agent.
- **Safety boundaries and best practices**: each Agent shows its safety boundaries and recommended usage.
- **Manifest / runtime target first**: capability and model metadata prefer adapter manifests, runtime targets, and probe results; built-in defaults remain conservative fallbacks for current entries.

## Health Diagnostics

Health conclusions prefer runtime probes, adapter health checks, or verifiable local configuration. Facts that cannot be confirmed remain `unknown` instead of being presented as certain.

- **More honest probing**: installation, callability, WSL/Bridge, and version information are derived from runtime commands or adapter-reported facts where possible; login, configuration, model, and key readiness are reported only when the runtime or adapter exposes a verifiable signal, otherwise they stay unknown.
- **Honest unknowns**: any field that cannot be confirmed is shown as `unknown` instead of being faked as healthy. An Agent is never reported as available unless at least one field is positively verified.
- **Credential safety**: login and key configuration status remain `unknown` unless the runtime or adapter provides a verifiable signal; key values are never displayed, and diagnostic output redacts secret-bearing lines.
- **Evidence chain**: each health field can show its source and check time, so a status is traceable rather than opaque.
- **Interactive repair actions**: when a health result includes a `repair_hint`, the UI can offer actionable next steps — copy the fix command, open the relevant configuration dialog, or re-probe in place.

## Image Input in the Composer

The composer now accepts images, so multimodal-capable runtimes can receive them.

- Paste an image from the clipboard or drag-and-drop it into the input; a thumbnail preview appears in the attachment tray.
- Images are sent as ACP image content blocks (base64), separate from the text prompt — never inlined into the prompt string.
- Image input is gated by the runtime's advertised ACP `promptCapabilities.image`; agents that do not support images block the paste with a clear notice instead of silently dropping it.
- Guardrails: image type whitelist (png/jpeg/gif/webp; svg excluded) and a per-image size limit.

## Runtime Session Card

The Session Card continues to focus on session readability, execution process, response, history, and restore. Runtime Sessions use `title`, Turns use `prompt`; no Task fields or Task status are introduced.

- Day-file history writes are serialized to prevent lost updates under concurrent turns.
- ACP readers are byte-tolerant, hardening streaming against partial frames.

## Still-Valid Foundation

- Windows-first local desktop workspace.
- Claude Code, Hermes, and OpenAI Codex entry messaging.
- Runtime Session Card surfaces for output, thought, runtime events, and final response.
- Separation between live, history, and archived sessions.
- Local JSON session history, restore, and read-only archive open.
- zh-CN / en-US UI language switching persisted locally.

## What This Release Does Not Claim

- It does not include Session Handoff.
- It does not include a Task Board, Task management, or automatic task distribution.
- It does not provide automatic multi-agent orchestration or Team Mode.
- It does not promise a shared memory bus.
- It does not include a marketplace or a complete billing platform.

Installation and run details: [Getting Started](./getting-started.md).
