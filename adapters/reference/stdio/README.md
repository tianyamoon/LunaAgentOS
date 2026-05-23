# Stdio Adapter Reference

This directory contains reference files for a stdio-based adapter implementation.

It shows the adapter contract shape around manifest loading, stdio process lifecycle, stream handling, and normalized events. New adapter work starts from the public contract in [`../../../protocol/`](../../../protocol/) and the first-party manifests in [`../../first-party/`](../../first-party/).

## Contents

- `adapter.py`: stdio adapter implementation reference.
- `mock_agent.py`: mock process that emits JSON-like runtime events.
- `test_runner.py`: local runner for the mock adapter.
- `plugins/`: manifest examples.

## Status

The active public adapter direction is the protocol manifest plus adapter host model.
