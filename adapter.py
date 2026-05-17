from __future__ import annotations

import asyncio
import contextlib
import json
import os
import signal
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


STATE_INIT = 0
STATE_IDLE = 1
STATE_THINK = 2
STATE_TOOLING = 3
STATE_RESP = 4
STATE_DONE = 5
STATE_ERROR = 9

TTY_ERROR_HINTS = (
    "not a terminal",
    "stdin is not a tty",
    "stdout is not a tty",
    "requires a tty",
    "tty",
)


@dataclass(slots=True)
class Manifest:
    id: str
    name: str
    transport: str
    command: list[str]
    requires_pty: bool = False

    @classmethod
    def from_file(cls, manifest_path: str | Path) -> "Manifest":
        path = Path(manifest_path)
        data = json.loads(path.read_text(encoding="utf-8"))
        required = ("id", "name", "transport", "command")
        missing = [key for key in required if key not in data]
        if missing:
            raise ValueError(f"manifest missing required fields: {', '.join(missing)}")
        command = data["command"]
        if not isinstance(command, list) or not all(isinstance(item, str) for item in command):
            raise ValueError("manifest command must be a list[str]")
        return cls(
            id=data["id"],
            name=data["name"],
            transport=data["transport"],
            command=command,
            requires_pty=bool(data.get("requires_pty", False)),
        )


class LogScrubber:
    """Extract JSON objects from noisy text streams."""

    def extract_messages(self, line: str) -> list[dict[str, Any]]:
        stripped = line.strip()
        if not stripped:
            return []

        direct = self._try_parse_json(stripped)
        if direct is not None:
            return [direct]

        extracted: list[dict[str, Any]] = []
        for candidate in self._extract_json_candidates(stripped):
            parsed = self._try_parse_json(candidate)
            if parsed is not None:
                extracted.append(parsed)
        return extracted

    def _try_parse_json(self, text: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    def _extract_json_candidates(self, text: str) -> list[str]:
        candidates: list[str] = []
        start: int | None = None
        depth = 0
        in_string = False
        escape = False

        for index, char in enumerate(text):
            if start is None:
                if char == "{":
                    start = index
                    depth = 1
                    in_string = False
                    escape = False
                continue

            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    candidates.append(text[start : index + 1])
                    start = None
        return candidates


class StateInferer:
    """Infer lifecycle state when the upstream CLI does not provide one."""

    ALLOWED_TYPES = {"thought", "tool_request", "tool_result", "response", "state", "log"}

    def infer_state(self, message_type: str | None, payload: dict[str, Any], fallback_text: str = "") -> int:
        text = " ".join(
            str(part)
            for part in (
                message_type or "",
                payload.get("content", ""),
                payload.get("message", ""),
                payload.get("tool_name", ""),
                fallback_text,
            )
            if part
        ).lower()

        if message_type == "tool_request":
            return STATE_TOOLING
        if message_type == "tool_result":
            return STATE_TOOLING
        if message_type == "response":
            return STATE_RESP
        if "error" in text or "failed" in text or "exception" in text:
            return STATE_ERROR
        if "done" in text or "complete" in text or "finished" in text:
            return STATE_DONE
        if "tool" in text or "running tool" in text or "calling tool" in text:
            return STATE_TOOLING
        if "think" in text or "analy" in text or "reason" in text or message_type == "thought":
            return STATE_THINK
        if message_type == "state":
            return STATE_IDLE
        return STATE_IDLE

    def infer_type(self, raw: dict[str, Any]) -> str:
        if isinstance(raw.get("type"), str) and raw["type"]:
            raw_type = raw["type"]
            if raw_type == "done":
                return "state"
            return raw_type if raw_type in self.ALLOWED_TYPES else "log"

        payload = raw.get("payload", {})
        text = ""
        if isinstance(payload, dict):
            text = str(payload.get("content", ""))
        state = raw.get("state")
        if state == STATE_TOOLING or "tool_name" in payload:
            return "tool_request"
        if state == STATE_RESP:
            return "response"
        if state == STATE_DONE:
            return "state"
        if "think" in text.lower():
            return "thought"
        return "log"


class StdioAgentAdapter:
    def __init__(
        self,
        manifest_path: str | Path,
        *,
        emit_to_stdout: bool = True,
        cwd: str | Path | None = None,
    ) -> None:
        self.manifest_path = Path(manifest_path)
        self.manifest = Manifest.from_file(self.manifest_path)
        self.emit_to_stdout = emit_to_stdout
        self.cwd = Path(cwd) if cwd is not None else self.manifest_path.parent
        self.scrubber = LogScrubber()
        self.state_inferer = StateInferer()
        self.events: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.process: asyncio.subprocess.Process | None = None
        self._reader_tasks: list[asyncio.Task[None]] = []
        self._watcher_task: asyncio.Task[None] | None = None
        self._running = False
        self._last_state = STATE_INIT
        self._pty_mode = False
        self._startup_logs: list[str] = []

    async def start(self) -> None:
        if self._running:
            return

        await self._emit("state", STATE_INIT, {"content": f"starting {self.manifest.name}"})
        await self._spawn_process(use_pty=self.manifest.requires_pty)
        self._running = True

        assert self.process is not None
        self._reader_tasks = [
            asyncio.create_task(self._read_stream(self.process.stdout, "stdout")),
            asyncio.create_task(self._read_stream(self.process.stderr, "stderr")),
        ]
        self._watcher_task = asyncio.create_task(self._watch_process())
        await self._emit("state", STATE_IDLE, {"content": f"{self.manifest.name} ready"})

    async def send_prompt(self, text: str) -> None:
        await self.send_command(
            {
                "id": self._new_id("task"),
                "type": "prompt",
                "payload": {"content": text},
            }
        )

    async def send_tool_result(self, tool_name: str, result: str) -> None:
        await self.send_command(
            {
                "id": self._new_id("task"),
                "type": "tool_result_inject",
                "payload": {"tool_name": tool_name, "result": result},
            }
        )

    async def send_command(self, command: dict[str, Any]) -> None:
        if self.process is None or self.process.stdin is None:
            raise RuntimeError("adapter process is not running")
        line = json.dumps(command, ensure_ascii=False) + "\n"
        self.process.stdin.write(line.encode("utf-8"))
        await self.process.stdin.drain()

    async def stop(self) -> None:
        if self.process is None:
            return

        with contextlib.suppress(Exception):
            await self.send_command(
                {
                    "id": self._new_id("task"),
                    "type": "abort",
                    "payload": {"content": "adapter shutdown"},
                }
            )

        try:
            await asyncio.wait_for(self.process.wait(), timeout=1.5)
        except asyncio.TimeoutError:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=1.5)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

        await self._cleanup_tasks()

    async def _spawn_process(self, *, use_pty: bool) -> None:
        self._pty_mode = use_pty

        if use_pty and os.name != "posix":
            await self._emit(
                "log",
                STATE_IDLE,
                {"content": "PTY requested but unavailable on this platform; falling back to stdio"},
            )
            use_pty = False
            self._pty_mode = False

        if use_pty:
            self.process = await self._spawn_posix_pty_process()
        else:
            self.process = await asyncio.create_subprocess_exec(
                *self.manifest.command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.cwd),
            )

    async def _spawn_posix_pty_process(self) -> asyncio.subprocess.Process:
        import pty

        master_fd, slave_fd = pty.openpty()
        try:
            process = await asyncio.create_subprocess_exec(
                *self.manifest.command,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=str(self.cwd),
            )
        finally:
            os.close(slave_fd)

        stdout = os.fdopen(os.dup(master_fd), "rb", buffering=0)
        stdin = os.fdopen(os.dup(master_fd), "wb", buffering=0)
        os.close(master_fd)

        loop = asyncio.get_running_loop()
        process.stdout = asyncio.StreamReader()
        stdout_protocol = asyncio.StreamReaderProtocol(process.stdout)
        await loop.connect_read_pipe(lambda: stdout_protocol, stdout)

        process.stderr = asyncio.StreamReader()
        stderr_protocol = asyncio.StreamReaderProtocol(process.stderr)
        await loop.connect_read_pipe(lambda: stderr_protocol, stdout)

        writer_transport, writer_protocol = await loop.connect_write_pipe(asyncio.streams.FlowControlMixin, stdin)
        process.stdin = asyncio.StreamWriter(writer_transport, writer_protocol, None, loop)
        return process

    async def _read_stream(self, stream: asyncio.StreamReader | None, stream_name: str) -> None:
        if stream is None:
            return

        while True:
            line = await stream.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if text:
                self._startup_logs.append(text)
            await self._handle_line(text, stream_name=stream_name)

    async def _handle_line(self, line: str, *, stream_name: str) -> None:
        if self.manifest.transport == "stdio_json":
            parsed = self.scrubber.extract_messages(line)
            if parsed:
                for item in parsed:
                    await self._handle_raw_message(item, raw_text=line)
                return
            await self._emit("log", self._last_state, {"content": line, "stream": stream_name})
            return

        if self.manifest.transport == "stdio_text":
            parsed = self.scrubber.extract_messages(line)
            if parsed:
                for item in parsed:
                    await self._handle_raw_message(item, raw_text=line)
                return

            inferred_state = self.state_inferer.infer_state("log", {"content": line}, line)
            await self._emit("log", inferred_state, {"content": line, "stream": stream_name})
            return

        await self._emit(
            "log",
            STATE_ERROR,
            {"content": f"unsupported transport: {self.manifest.transport}", "stream": stream_name},
        )

    async def _handle_raw_message(self, raw: dict[str, Any], raw_text: str) -> None:
        payload = raw.get("payload")
        if not isinstance(payload, dict):
            payload = {
                key: value
                for key, value in raw.items()
                if key not in {"id", "type", "state", "timestamp", "payload"}
            }
            if not payload:
                payload = {"content": raw_text}

        message_type = self.state_inferer.infer_type({"type": raw.get("type"), "payload": payload, "state": raw.get("state")})
        state = raw.get("state")
        if not isinstance(state, int):
            state = self.state_inferer.infer_state(message_type, payload, raw_text)
        if message_type == "state" and state == STATE_DONE:
            payload.setdefault("content", "task complete")
        await self._emit(message_type, state, payload, source_id=raw.get("id"), timestamp=raw.get("timestamp"))

    async def _watch_process(self) -> None:
        if self.process is None:
            return
        return_code = await self.process.wait()

        if return_code == 0 and self._last_state not in {STATE_DONE, STATE_ERROR}:
            await self._emit("state", STATE_DONE, {"content": f"{self.manifest.name} exited cleanly"})
        elif return_code != 0:
            error_text = "\n".join(self._startup_logs[-5:])
            if self._should_retry_with_pty(error_text):
                await self._emit(
                    "log",
                    STATE_ERROR,
                    {"content": "TTY error detected; PTY retry requested but process already exited"},
                )
            await self._emit(
                "log",
                STATE_ERROR,
                {"content": f"{self.manifest.name} exited with code {return_code}"},
            )
            await self._emit("state", STATE_ERROR, {"content": error_text or "agent process failed"})

    def _should_retry_with_pty(self, error_text: str) -> bool:
        if self._pty_mode:
            return False
        lowered = error_text.lower()
        return any(hint in lowered for hint in TTY_ERROR_HINTS)

    async def _cleanup_tasks(self) -> None:
        current_task = asyncio.current_task()
        for task in self._reader_tasks:
            if not task.done():
                task.cancel()
        if self._watcher_task is not None and self._watcher_task is not current_task and not self._watcher_task.done():
            self._watcher_task.cancel()
        for task in [*self._reader_tasks, self._watcher_task]:
            if task is None or task is current_task:
                continue
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._reader_tasks = []
        self._watcher_task = None
        self._running = False

    async def _emit(
        self,
        message_type: str,
        state: int,
        payload: dict[str, Any],
        *,
        source_id: str | None = None,
        timestamp: int | None = None,
    ) -> None:
        event = {
            "id": source_id or self._new_id("msg"),
            "type": message_type,
            "state": state,
            "timestamp": timestamp or int(time.time()),
            "payload": payload,
        }
        self._last_state = state
        await self.events.put(event)
        if self.emit_to_stdout:
            print(json.dumps(event, ensure_ascii=False), flush=True)

    def _new_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:12]}"


async def _main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: python adapter.py <manifest.json>")
    adapter = StdioAgentAdapter(sys.argv[1], emit_to_stdout=True)
    await adapter.start()
    try:
        while True:
            await asyncio.sleep(3600)
    except KeyboardInterrupt:
        pass
    finally:
        await adapter.stop()


if __name__ == "__main__":
    if os.name == "nt":
        with contextlib.suppress(AttributeError):
            signal.signal(signal.SIGTERM, signal.SIG_DFL)
    asyncio.run(_main())
