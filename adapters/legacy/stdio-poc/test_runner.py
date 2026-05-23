from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from adapter import (
    STATE_DONE,
    STATE_INIT,
    STATE_RESP,
    STATE_THINK,
    STATE_TOOLING,
    StdioAgentAdapter,
)


STATE_NAMES = {
    0: "INIT",
    1: "IDLE",
    2: "THINK",
    3: "TOOLING",
    4: "RESP",
    5: "DONE",
    9: "ERROR",
}


async def main() -> None:
    repo_root = Path(__file__).resolve().parent
    manifest_path = repo_root / "plugins" / "mock" / "manifest.json"
    runtime_manifest_path = repo_root / "plugins" / "mock" / "manifest.runtime.json"

    base_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    base_manifest["command"] = [sys.executable, str((repo_root / "mock_agent.py").resolve())]
    runtime_manifest_path.write_text(json.dumps(base_manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    adapter = StdioAgentAdapter(runtime_manifest_path, emit_to_stdout=False, cwd=repo_root)
    expected = [STATE_INIT, STATE_THINK, STATE_TOOLING, STATE_RESP, STATE_DONE]
    seen_states: list[int] = []

    await adapter.start()
    await adapter.send_prompt("Summarize today's adapter validation task.")

    try:
        while True:
            event = await asyncio.wait_for(adapter.events.get(), timeout=10)
            state_name = STATE_NAMES.get(event["state"], str(event["state"]))
            print(f"[{state_name:<7}] {event['type']:<12} {json.dumps(event['payload'], ensure_ascii=False)}")

            state = event["state"]
            if state not in seen_states:
                seen_states.append(state)

            if event["type"] == "tool_request":
                tool_name = event["payload"].get("tool_name", "unknown_tool")
                await adapter.send_tool_result(tool_name, "market open, protocol healthy, tool bridge works")

            if state == STATE_DONE:
                break
    finally:
        await adapter.stop()

    filtered_states = [state for state in seen_states if state in expected]
    if filtered_states != expected:
        raise SystemExit(
            f"state flow mismatch: expected {[STATE_NAMES[s] for s in expected]}, got {[STATE_NAMES[s] for s in filtered_states]}"
        )

    print("\nValidation passed: INIT -> THINK -> TOOLING -> RESP -> DONE")


if __name__ == "__main__":
    asyncio.run(main())
