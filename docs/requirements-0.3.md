# LunaAgentOS 0.3 Requirement Definition

[中文](./requirements-0.3.zh-CN.md)

LunaAgentOS is heading toward a personal Agent operating system for the AI era.

0.3 is the next milestone on that road: on top of the 0.2 workspace foundation, let users actually manage their agent entries, and let each session card behave more like a live task surface than a loose output log.

## What 0.3 focuses on

0.3 focuses on two product areas:

- **Agent availability management**: when users open LunaAgentOS, they should know which agents are usable, why an agent is not usable, what each agent is good for, and how to move it toward a working state.
- **Session cards as task surfaces**: when users look at a session card, they should know the task state, what happened, what was produced, and what can happen next.

These two areas are already large enough, and they build directly on the current product foundation.

## Agent Availability Management

Agent Fleet should become more than a list of launch entries. It should become the place where users manage their agent working environment.

Each agent should gradually expose:

- **Identity**: agent name, provider, profile, account identity, runtime location, and default working directory.
- **Model management**: available models, default model, recommended model, and what different models are good for.
- **Capability boundary**: whether it can read/write files, run commands, access the network, handle images, operate a browser, or attach to a local repository.
- **Health state**: whether it is installed, logged in, callable as a CLI, properly configured through environment variables, connected through WSL or bridge paths, and not too old.
- **Repair guidance**: when an entry is unavailable, the product should explain the likely next check instead of only showing failure.
- **Best practices**: what this agent is good at, what it is not good at, how to prompt it reliably, and what context should be included during handoff.
- **Safety boundary**: what the agent is allowed to do, and which actions require user confirmation.
- **Resource awareness**: 0.3 does not need full billing, but it should leave room for model quota, context waste, and expensive-runtime warnings.

0.3 does not need to fix every environment problem automatically. It should remove guesswork.

## Session Cards as Task Surfaces

Runtime Session Card is the central object in LunaAgentOS. In 0.3, it should move from process display toward task management.

Each card should make these things clearer:

- **Task identity**: what this card is doing, which agent owns it, and which entry or profile it came from.
- **Task state**: waiting for input, running, waiting for confirmation, blocked, failed, completed, archived, or read-only history.
- **Process layers**: key progress and result by default, with thought, tool, runtime event, and debug details available when expanded.
- **Artifact summary**: final response, file changes, commands run, errors, next-step suggestions, and handoff-ready summary.
- **Actions**: continue, retry, archive, mark completed, mark failed, generate handoff summary, and send to another agent.
- **Context selection**: during handoff, users can choose the original task, final response, error logs, file diff summary, or a manual note.
- **Relationship metadata**: whether this card came from another card, continues another card, retries it, branches from it, or is a handoff result.

Users should not need to read the full log to understand what happened.

## How the two areas connect

Agent management answers “who can do the work.” Session cards answer “where the work stands.”

In 0.3, these should connect:

- A session card can show the current agent's key health state.
- When an agent is unavailable, the card can explain why instead of only failing.
- When a session fails or gets blocked, the product can suggest which agents may be better suited to continue.
- When a session completes, it can produce a handoff summary for another agent.
- Handoff stays explicit and user-triggered, keeping human control. Automatic multi-agent orchestration is a topic for a later stage.

## Minimum releasable scope

A controlled 0.3 scope can include:

- Agent detail panel.
- Agent health checks and configuration diagnostics.
- Basic model, capability, profile, and runtime-location display.
- Best-practice notes for each agent.
- Session card state system.
- Compact, process, and debug views for session cards.
- Session result summary area.
- Continue, retry, archive, mark completed, and mark failed actions.
- First manual handoff: select context, generate summary, and send it to another agent or session.

## Outside the 0.3 scope

The following milestones unfold in later releases:

- Full automatic multi-agent orchestration.
- Automatic agent-to-agent calling.
- Agent marketplace.
- Team mode.
- Full billing and budget platform.
- Shared memory bus across agents.

These are later segments on the road to a full operating system, not 0.3 release promises. To say it once: the adapter layer is a translator, not a homogenizer — each external agent keeps its own internal mechanism.

## Relationship to the current roadmap

This page makes the next step concrete; it does not change the definition of LunaAgentOS.

The direction remains a personal Agent operating system for the AI era. On the 0.2 workspace foundation, 0.3 hardens the two most basic operating-system responsibilities:

- Manage available execution entries.
- Manage live tasks.

Once these are steady, later releases continue toward stronger handoff, collaboration, control-plane behavior, and a fuller operating layer.
