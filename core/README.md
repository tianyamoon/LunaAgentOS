# LunaAgentOS Core

Core is the runtime operating layer between adapter manifests and the App.

It owns the system responsibilities that make heterogeneous agent products feel coherent:

- Adapter discovery.
- Adapter lifecycle.
- Runtime probing.
- Runtime session creation, load, resume, shutdown, and health checks.
- Event normalization.
- Capability negotiation.
- Permission and approval flow.
- History, replay, and restore.

The current implementation still lives primarily inside the App backend under `apps/desktop-shell/src-tauri`. This directory defines the target core seams and guides the extraction path.
