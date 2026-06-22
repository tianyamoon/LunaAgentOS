# LunaAgentOS 0.3.0 Release Notes

[中文](./release-notes-0.3.zh-CN.md)

LunaAgentOS 0.3.0 makes two foundation capabilities solid on top of the runtime session workspace: **Agent management** (identity, profile, model, capabilities, safety, best practices) and **real health diagnostics**. The release keeps Runtime Session and Task strictly separated — Task, Handoff, and orchestration remain later phases.

See [0.3 Requirements](./requirements-0.3.md) for the full scope definition.

## Agent Management

- **Agent identity and runtime detail**: each Agent surfaces its name, provider, profile, account identity, runtime environment, runtime command, and default working directory.
- **Model control honesty**: adapters that support LunaAgentOS-managed defaults let you pick and save the default model for new Runtime Sessions; other agents are explicitly shown as runtime-managed, and an in-session `/model` is not treated as a persistent default.
- **Capability matrix**: files, commands, network, images, browser, and local-repo capabilities are presented per Agent.
- **Safety boundaries and best practices**: each Agent shows its safety boundaries and recommended usage.
- **Manifest-driven, not UI copy**: capability and model metadata are sourced from adapter manifests so management reflects real adapter facts rather than hard-coded frontend text.

## Real Health Diagnostics

Health conclusions come from real runtime probes, adapter health checks, or verifiable local configuration — never from assumptions.

- **Real probing**: install / callable / login / configuration / WSL or bridge / model or key / version are derived from actually running the runtime command, not placeholder data.
- **Honest unknowns**: any field that cannot be confirmed is shown as `unknown` instead of being faked as healthy. An Agent is never reported as available unless at least one field is positively verified.
- **Credential safety**: keys are only checked for presence, never displayed, and presence alone is never claimed as validity. Diagnostic output redacts secret-bearing lines.
- **Evidence chain**: each health field can show its source and check time, so a status is traceable rather than opaque.
- **Interactive repair actions**: unavailable items offer actionable next steps — copy the fix command, open the relevant configuration dialog, or re-probe in place.

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
- Claude Code, Hermes, and OpenAI Codex Manifest entry messaging.
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
