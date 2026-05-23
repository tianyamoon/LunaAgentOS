# Legacy Stdio POC

This directory preserves the early stdio adapter proof of concept.

It records useful implementation lessons around manifest loading, stdio process lifecycle, noisy stream handling, and normalized events. New adapter work starts from the public contract in [`../../../protocol/`](../../../protocol/) and the first-party manifests in [`../../first-party/`](../../first-party/).

## Contents

- `adapter.py`: early stdio adapter implementation.
- `mock_agent.py`: mock process that emits JSON-like runtime events.
- `test_runner.py`: local runner for the mock adapter.
- `plugins/`: early manifest examples.

## Status

This POC is archived as implementation history. The active public adapter direction is the protocol manifest plus adapter host model.
