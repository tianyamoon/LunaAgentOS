# LunaAgentOS 0.3 Requirements

[简体中文](./requirements-0.3.zh-CN.md)

The current 0.3 stage first makes each Agent understandable, configurable, and reliable while keeping Runtime Session and Task as distinct product objects.

## Product Object Boundary

- A **Runtime Session** is an Agent Entry's conversation environment. It owns session state, execution, responses, history, and recovery.
- A **Session title** is the Runtime Session's stable display title, derived from the first non-empty line of the first prompt. Later Turns do not change it.
- A **Turn prompt** is one user input. `runtimePrompt` is the actual runtime input after attachment or wrapper expansion.
- A **Runtime Session Card** presents exactly one Runtime Session. It is not a Task and does not act as a Task Board.
- A **Task** is a future schedulable work unit that may be split, assigned, and tracked across Runtime Sessions. This stage adds no Task model or management UI.

## Current Stage

### Agent Management

Users can inspect Agent identity, runtime environment, Profile, working directory, models, capability boundaries, safety boundaries, and best practices.

- Adapters that declare persistent LunaAgentOS model control may offer a saved default for newly created Runtime Sessions.
- Other Agents state that models are managed by the native runtime. An in-session `/model` command is not persistent default-model management.

### Agent Health Diagnostics

Users can inspect installation and invocation, login or configuration requirements, Profile, WSL/Bridge, model or key readiness, version attention, concrete failure reasons, and suggested next steps.

Conclusions come from the real runtime, adapter health checks, or verifiable local configuration. Unconfirmed fields remain unknown. Secret values are never displayed, and presence alone does not claim validity.

## Not In This Stage

- Session Handoff
- Task Board, Task management, or automatic assignment
- Automatic multi-Agent orchestration or team mode
- Shared memory bus
- Marketplace
- Full billing platform

Session Cards remain focused on conversation readability, execution, responses, history, and recovery. Runtime Session uses `title`, Turn uses `prompt`, and neither introduces Task fields or Task states.
