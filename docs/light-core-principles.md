# Light-Core Principles

LunaAgentOS is strongest when the control layer stays focused.

These principles explain what "light core" means in practice.

## 1. Keep runtime-specific logic at the edge

Different runtimes expose different surfaces and behaviors. LunaAgentOS should normalize what it needs for coordination, history, and visibility, while leaving runtime-native behavior in adapters whenever possible.

## 2. Make the human workspace coherent

The product should help a human operator understand:

- which runtime they are using
- what session is active
- what the runtime is currently doing
- what history can be restored later

The goal is not more chrome. The goal is less confusion.

## 3. Preserve native strengths

Claude Code, Hermes, and future entries should still feel like themselves. LunaAgentOS should make them easier to observe and operate together, not flatten them into one generic response surface.

## 4. Treat process visibility as product value

Thought, tool, plan, usage, and state events are not debug leftovers. When exposed responsibly, they are part of the product value of a control layer.

## 5. Prefer durable sessions over disposable prompts

LunaAgentOS is organized around Runtime Sessions, not around isolated send-and-forget requests. History, restore behavior, and session identity are part of the core product shape.

## 6. Grow the contract before the platform story

The extension model only becomes real after the contract is stable enough to support new runtimes without constant bespoke changes.

That means the project should first strengthen:

- adapter manifests
- normalized runtime events
- capability modeling
- local history and restore behavior
- workspace routing semantics

## 7. Stay honest about current scope

The light core stays credible when the project is explicit about what is ready now, what is still directional, and what belongs to a later layer.
