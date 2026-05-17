from __future__ import annotations

import asyncio
import json
import sys
import time
import uuid
from typing import Any


def emit(data: dict[str, Any]) -> None:
    print(json.dumps(data, ensure_ascii=False), flush=True)


def noisy(line: str) -> None:
    print(line, flush=True)


def message(message_type: str, state: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"mock_{uuid.uuid4().hex[:10]}",
        "type": message_type,
        "state": state,
        "timestamp": int(time.time()),
        "payload": payload,
    }


async def main() -> None:
    noisy("Booting mock agent...")
    emit(message("state", 0, {"content": "mock agent starting"}))
    noisy('DEBUG >>> {"type":"noise","content":"ignore me"}')
    emit(message("state", 1, {"content": "mock agent idle"}))

    while True:
        line = await asyncio.to_thread(sys.stdin.readline)
        if not line:
            return
        try:
            incoming = json.loads(line)
        except json.JSONDecodeError:
            noisy(f"NON_JSON_INPUT::{line.rstrip()}")
            continue

        command_type = incoming.get("type")
        if command_type == "abort":
            emit(message("state", 5, {"content": "mock agent aborted"}))
            return

        if command_type == "prompt":
            prompt = incoming.get("payload", {}).get("content", "")
            noisy(f"Received prompt: {prompt}")
            emit(message("thought", 2, {"content": f"Thinking about: {prompt}"}))
            noisy('INFO before tool {"type":"log","payload":{"content":"tool step soon"}}')
            emit(
                message(
                    "tool_request",
                    3,
                    {
                        "content": "Need a tool result to continue",
                        "tool_name": "mock_search",
                        "tool_args": {"q": prompt},
                    },
                )
            )
            continue

        if command_type == "tool_result_inject":
            result = incoming.get("payload", {}).get("result", "")
            noisy("tool result injected")
            emit(message("response", 4, {"content": f"Final answer based on tool result: {result}"}))
            emit(message("state", 5, {"content": "mock task done"}))
            return


if __name__ == "__main__":
    asyncio.run(main())
