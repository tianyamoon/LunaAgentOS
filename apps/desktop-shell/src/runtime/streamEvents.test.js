import test from "node:test";
import assert from "node:assert/strict";
import {
  applyEventsToTurn,
  applyStreamEventToTurn,
  contentPartText,
  eventContentText,
  eventLogText,
  sessionSectionsFromEvents,
} from "./streamEvents.js";
import { TURN_STATUS } from "../state/sessionStatus.js";

function makeSession() {
  return {
    id: "session-1",
    task: "old task",
    state: 1,
    turns: [],
    activeTurnId: "turn-1",
  };
}

function makeTurn() {
  return {
    id: "turn-1",
    task: "build feature",
    thoughts: [],
    outputs: [],
    finalResponse: "",
    logs: [],
    state: 1,
    status: TURN_STATUS.created,
  };
}

test("contentPartText flattens nested runtime content", () => {
  assert.equal(contentPartText("hello"), "hello");
  assert.equal(contentPartText(42), "42");
  assert.equal(contentPartText(true), "true");
  assert.equal(
    contentPartText([{ text: "a" }, { content: [{ output: "b" }] }, { input: "c" }]),
    "a\nb\nc",
  );
});

test("eventLogText formats tool, plan, and usage events", () => {
  assert.equal(
    eventLogText({ type: "tool", payload: { title: "Read", status: "done", content: { text: "file.txt" } } }),
    "Read：done\nfile.txt",
  );
  assert.equal(
    eventLogText({ type: "plan", payload: { entries: [{ status: "doing", title: "Extract module" }] } }),
    "运行时更新了执行计划：\n[doing] Extract module",
  );
  assert.equal(
    eventLogText({ type: "usage", payload: { inputTokens: 3, output_tokens: 4, totalTokens: 7 } }),
    "用量更新：输入 3 · 输出 4 · 总计 7",
  );
});

test("eventContentText prefers payload.content and falls back to log text", () => {
  assert.equal(eventContentText({ type: "response", payload: { content: "hello" } }), "hello");
  assert.equal(eventContentText({ type: "response", payload: { content: [{ text: "a" }, { output: "b" }] } }), "a\nb");
  assert.equal(eventContentText({ type: "tool", payload: { title: "Search", status: "ok" } }), "Search：ok");
});

test("sessionSectionsFromEvents combines streaming thoughts/responses and filters noisy state", () => {
  const sections = sessionSectionsFromEvents([
    { type: "state", state: 0, payload: { content: "starting" } },
    { type: "thought", state: 2, payload: { content: "think " } },
    { type: "thought", state: 2, payload: { content: "more" } },
    { type: "response", state: 4, payload: { content: "final" } },
    { type: "state", state: 5, payload: { content: "final" } },
    { type: "tool", state: 3, payload: { title: "Read", status: "done" } },
  ]);
  assert.deepEqual(sections.thoughts, ["think more"]);
  assert.deepEqual(sections.outputs, ["final"]);
  assert.equal(sections.finalResponse, "final");
  assert.deepEqual(sections.logs, ["Read：done"]);
});

test("applyEventsToTurn replaces aggregate turn sections and updates session identity", () => {
  const session = makeSession();
  const turn = makeTurn();
  applyEventsToTurn(session, turn, [
    { type: "thought", state: 2, payload: { content: "t" } },
    { type: "response", state: 4, payload: { content: "done" } },
    { type: "state", state: 5, payload: { content: "done", sessionId: "acp-1" } },
  ]);
  assert.deepEqual(turn.thoughts, ["t"]);
  assert.deepEqual(turn.outputs, ["done"]);
  assert.equal(turn.finalResponse, "done");
  assert.equal(turn.state, 5);
  assert.equal(turn.status, TURN_STATUS.completed);
  assert.equal(session.state, 5);
  assert.equal(session.task, "build feature");
  assert.equal(session.activeTurnId, "turn-1");
  assert.equal(session.acpSessionId, "acp-1");
});

test("applyEventsToTurn writes ordered Timeline items for fallback and ACP batch events", () => {
  const session = makeSession();
  const turn = makeTurn();
  applyEventsToTurn(session, turn, [
    { type: "thought", state: 2, payload: { content: "先检查" } },
    { type: "tool", state: 3, payload: { title: "Read", status: "done" } },
    { type: "response", state: 5, payload: { content: "已完成" } },
  ]);
  assert.deepEqual(turn.timelineItems.map((item) => item.type), ["thinking", "tool", "assistant"]);
  assert.equal(turn.timelineItems[1].content, "Read");
  assert.equal(turn.timelineCompletedAt != null, true);
});

test("applyEventsToTurn preserves Turn start time when final ACP batch completes later", () => {
  const session = makeSession();
  const turn = {
    ...makeTurn(),
    timelineStartedAt: "1970-01-01T00:00:01.000Z",
  };

  applyEventsToTurn(session, turn, [
    { type: "response", state: 5, payload: { content: "已完成" } },
  ], { now: () => 6000 });

  assert.equal(turn.timelineStartedAt, "1970-01-01T00:00:01.000Z");
  assert.equal(turn.timelineCompletedAt, "1970-01-01T00:00:06.000Z");
});

test("applyStreamEventToTurn appends incremental thought and response chunks", () => {
  const session = makeSession();
  const turn = makeTurn();
  applyStreamEventToTurn(session, turn, { type: "thought", state: 2, payload: { content: "a" } });
  applyStreamEventToTurn(session, turn, { type: "thought", state: 2, payload: { content: "b" } });
  applyStreamEventToTurn(session, turn, { type: "response", state: 4, payload: { content: "c" } });
  applyStreamEventToTurn(session, turn, { type: "response", state: 4, payload: { content: "d", sessionId: "acp-2" } });
  assert.deepEqual(turn.thoughts, ["ab"]);
  assert.deepEqual(turn.outputs, ["cd"]);
  assert.equal(turn.finalResponse, "cd");
  assert.equal(turn.state, 4);
  assert.equal(turn.status, TURN_STATUS.running);
  assert.equal(session.state, 4);
  assert.equal(session.acpSessionId, "acp-2");
});

test("applyStreamEventToTurn preserves Timeline order when Tool interrupts Assistant stream", () => {
  const session = makeSession();
  const turn = makeTurn();
  applyStreamEventToTurn(session, turn, { type: "response", state: 4, payload: { content: "先检查" } });
  applyStreamEventToTurn(session, turn, { type: "tool", state: 3, payload: { title: "Read", status: "done" } });
  applyStreamEventToTurn(session, turn, { type: "response", state: 4, payload: { content: "再处理" } });
  assert.deepEqual(
    turn.timelineItems.map((item) => ({ type: item.type, content: item.content })),
    [
      { type: "assistant", content: "先检查" },
      { type: "tool", content: "Read" },
      { type: "assistant", content: "再处理" },
    ],
  );
});

test("applyStreamEventToTurn prepends tool/plan/usage/state logs", () => {
  const session = makeSession();
  const turn = makeTurn();
  applyStreamEventToTurn(session, turn, { type: "tool", payload: { title: "Run", status: "ok" } });
  applyStreamEventToTurn(session, turn, { type: "plan", payload: { entries: [] } });
  applyStreamEventToTurn(session, turn, { type: "usage", payload: { totalTokens: 9 } });
  applyStreamEventToTurn(session, turn, { type: "state", state: 5, payload: { content: "finished" } });
  assert.deepEqual(turn.logs, [
    "finished",
    "用量更新：总计 9",
    "运行时更新了执行计划。",
    "Run：ok",
  ]);
  assert.equal(turn.state, 5);
  assert.equal(turn.status, TURN_STATUS.completed);
  assert.equal(session.state, 5);
});
