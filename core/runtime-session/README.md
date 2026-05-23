# Runtime Session

Runtime Session is the shared operating model for work happening inside external agent products.

## Model

A Runtime Session contains:

- Adapter identity.
- Runtime instance identity.
- Target or profile identity.
- Turns.
- Runtime events.
- Lifecycle state.
- History and restore metadata.

The App renders this model as Runtime Session Cards, live session lists, archived history, and restore flows.

## Lifecycle

The lifecycle vocabulary is:

```text
draft -> live -> stopped -> archived -> restoring -> resume_failed -> deleted
```

Only sessions attached to the current frontend runtime process are shown as live. History entries from previous app runs are restorable archived records until a runtime is attached again.
