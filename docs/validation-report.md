# LunaAgentOS CLI Adapter POC Validation

## Scope validated locally

Validated on `2026-05-18` with the bundled Python runtime:

- `adapter.py`
- `mock_agent.py`
- `test_runner.py`
- `plugins/mock/manifest.json`

## Protocol result

The mock flow completed successfully with noisy stdout mixed into the stream:

```text
INIT -> THINK -> TOOLING -> RESP -> DONE
```

The adapter successfully demonstrated:

- manifest loading
- async subprocess startup
- stdin prompt delivery
- noisy stdout filtering
- JSON extraction from mixed text
- state normalization
- tool request / tool result injection
- graceful completion

## Command used

```powershell
C:\Users\tiany\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe test_runner.py
```

## Real target probe result

The local machine does not currently expose these commands on PATH:

- `claude`
- `hermes`
- `trae`

That means the protocol layer is validated, but real-runtime integration still depends on installing or exposing the upstream products locally.

## Interpretation

- `Claude Code`: not locally runnable yet, but remains a valid Phase 0 adapter target.
- `Hermes`: not locally runnable yet, but remains the best first real adapter target once installed.
- `Trae IDE`: product-priority target, but not a native CLI manifest target in the current phase.

## Architecture note

This validation was performed with Python as a protocol-proof tool only.

It should not be interpreted as a final product-stack decision. The current preferred long-term direction is documented in `docs/tech-stack-decision.md`.
