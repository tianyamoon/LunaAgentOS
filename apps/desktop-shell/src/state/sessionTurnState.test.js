import test from "node:test";
import assert from "node:assert/strict";
import { createSessionsStore } from "./sessionsStore.js";
import { createSessionRuntimeState } from "./sessionRuntimeState.js";
import { createSessionTurnState } from "./sessionTurnState.js";
import {
  RUNTIME_BINDING_STATE,
  TURN_STATUS,
} from "./sessionStatus.js";

function translate(key, params = {}) {
  if (key === "runtime.promptFailedTitle") return `Prompt failed: ${params.agent}`;
  return key;
}

function makeState() {
  const sessionsStore = createSessionsStore();
  const sessionRuntimeState = createSessionRuntimeState({ sessionsStore });
  const sessionTurnState = createSessionTurnState({
    sessionsStore,
    sessionRuntimeState,
    translate,
    // 测试通用 metadata 扩展点，不让 Turn State 理解具体 Adapter。
    buildTurnMeta: (session) => (
      session.adapterMetadata ? { adapterMetadata: session.adapterMetadata } : {}
    ),
    now: () => 1000,
  });
  return { sessionsStore, sessionRuntimeState, sessionTurnState };
}

function makeSession(id = "session-1", overrides = {}) {
  return {
    id,
    agentName: "Hermes",
    turns: [],
    ...overrides,
  };
}

test("sessionTurnState: createTurn owns session and binding mutation", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("create", { adapterMetadata: { profileName: "default" } });
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task", {
    runtimePrompt: "runtime task",
    attachments: [{ name: "a.txt" }],
  });
  assert.equal(turn.id, "turn-1000-1");
  assert.equal(turn.status, TURN_STATUS.running);
  assert.equal(turn.runtimePrompt, "runtime task");
  assert.equal(turn.finalResponse, "");
  assert.deepEqual(turn.meta.adapterMetadata, { profileName: "default" });
  assert.deepEqual(turn.meta.attachments, [{ name: "a.txt" }]);
  assert.equal(session.activeTurnId, turn.id);
  assert.equal(session.runtime_binding.state, RUNTIME_BINDING_STATE.connected);
});

test("sessionTurnState: aggregate and stream events update the located turn", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("events");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");
  sessionTurnState.appendStreamEvent(session.id, turn.id, "run-1", {
    type: "tool",
    payload: { title: "Read", status: "ok" },
  });
  assert.match(turn.logs[0], /Read/);
  sessionTurnState.updateTurnFromEvents(session.id, turn.id, "run-1", [
    { type: "response", state: 5, payload: { content: "done" } },
  ]);
  assert.equal(turn.finalResponse, "done");
  assert.equal(turn.status, TURN_STATUS.completed);
  assert.equal(sessionTurnState.appendStreamEvent(session.id, turn.id, "run-1", {
    type: "tool",
    payload: { title: "Late", status: "ok" },
  }), null);
  assert.equal(turn.logs.some((item) => /Late/.test(item)), false);
});

test("sessionTurnState: completePromptRunFromEvents atomically settles turn and session", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("complete-run");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");

  const result = sessionTurnState.completePromptRunFromEvents(session.id, turn.id, "run-1", [
    { type: "response", state: 4, payload: { content: "done without final state" } },
  ]);

  assert.equal(result.turn.finalResponse, "done without final state");
  assert.equal(result.turn.status, TURN_STATUS.completed);
  assert.equal(result.turn.state, 5);
  assert.equal(result.session.state, 5);
  assert.equal(result.session.activePromptRunId, null);
  assert.equal(Boolean(result.turn.timelineCompletedAt), true);
});

test("sessionTurnState: final batch can settle a turn already completed by stream state", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("stream-then-final");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");

  sessionTurnState.appendStreamEvent(session.id, turn.id, "run-1", {
    type: "response",
    state: 5,
    payload: { content: "stream done" },
  });
  assert.equal(turn.status, TURN_STATUS.completed);

  const result = sessionTurnState.completePromptRunFromEvents(session.id, turn.id, "run-1", [
    { type: "response", state: 4, payload: { content: "final done" } },
    { type: "state", state: 5, payload: { content: "runtime complete", sessionId: "acp-final" } },
  ]);

  assert.equal(result.turn.finalResponse, "final done");
  assert.equal(result.session.acpSessionId, "acp-final");
  assert.equal(result.session.activePromptRunId, null);
});

test("sessionTurnState: completePromptRunFromEvents rejects mismatched prompt run", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("complete-mismatch");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");

  const result = sessionTurnState.completePromptRunFromEvents(session.id, turn.id, "run-other", [
    { type: "response", state: 5, payload: { content: "wrong" } },
  ]);

  assert.equal(result, null);
  assert.equal(turn.finalResponse, "");
  assert.equal(session.activePromptRunId, "run-1");
});

test("sessionTurnState: failPromptRun atomically settles failed prompt run", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("fail-run");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");

  const result = sessionTurnState.failPromptRun(session, turn, "run-1", "boom");

  assert.equal(result.turn.status, TURN_STATUS.failed);
  assert.equal(result.turn.state, 9);
  assert.equal(result.session.state, 9);
  assert.equal(result.session.activePromptRunId, null);
  assert.equal(result.turn.logs[0], "boom");
});

test("sessionTurnState: tombstones block late stream events", () => {
  const { sessionsStore, sessionRuntimeState, sessionTurnState } = makeState();
  const session = makeSession("stopped");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");
  sessionRuntimeState.setSessionLifecycle(session, "stopped");
  assert.equal(sessionTurnState.appendStreamEvent(session.id, turn.id, "run-1", {
    type: "response",
    payload: { content: "late" },
  }), null);
  assert.notEqual(turn.finalResponse, "late");
});

test("sessionTurnState: late stream event cannot leak into a newer turn", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("late-event");
  sessionsStore.upsertHead(session);
  const first = sessionTurnState.createTurn(session, "first");
  sessionTurnState.beginPromptRun(session, first, "run-first");
  sessionTurnState.endPromptRun(session, first, "run-first");
  const second = sessionTurnState.createTurn(session, "second");
  sessionTurnState.beginPromptRun(session, second, "run-second");

  assert.equal(sessionTurnState.appendStreamEvent(session.id, first.id, "run-first", {
    type: "response",
    payload: { content: "late answer" },
  }), null);
  assert.notEqual(first.finalResponse, "late answer");
  assert.notEqual(second.finalResponse, "late answer");
});

test("sessionTurnState: prompt run identity must match the exact turn", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("mismatch");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.beginPromptRun(session, turn, "run-1");

  assert.equal(sessionTurnState.appendStreamEvent(session.id, turn.id, "run-other", {
    type: "response",
    payload: { content: "wrong" },
  }), null);
  assert.notEqual(turn.finalResponse, "wrong");
});

test("sessionTurnState: prompt failure updates turn, session and runtime binding", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("failed");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.markPromptError(session, turn, "boom");
  assert.equal(turn.status, TURN_STATUS.failed);
  assert.equal(session.state, 9);
  assert.equal(session.runtime_binding.state, RUNTIME_BINDING_STATE.failed);
  assert.equal(session.runtime_binding.error_detail, "boom");
});

test("sessionTurnState: runtime logs dedupe and stopped turn gets a final response", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("logs");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionTurnState.appendRuntimeLog(session, "log", 3);
  sessionTurnState.appendRuntimeLog(session, "log", 3);
  assert.equal(turn.logs.filter((item) => item === "log").length, 1);
  assert.equal(sessionsStore.getFlowDetailOpen(`${turn.id}:logs`), false);
  sessionTurnState.markStopped(session);
  assert.equal(turn.state, 6);
  assert.equal(turn.finalResponse, "turn.stoppedResponse");
  assert.equal(session.state, 6);
});

test("sessionTurnState: runtime log prefers active turn over array tail", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("log-order", {
    activeTurnId: "executing",
    turns: [
      { id: "executing", state: 2, logs: [], finalResponse: "", status: TURN_STATUS.running },
      { id: "tail", state: 5, logs: [], finalResponse: "old", status: TURN_STATUS.completed },
    ],
  });
  sessionsStore.upsertHead(session);

  sessionTurnState.appendRuntimeLog(session, "active-only");

  assert.deepEqual(session.turns[0].logs, ["active-only"]);
  assert.deepEqual(session.turns[1].logs, []);
});

test("sessionTurnState: markStopped prefers an executing turn over a newer idle turn", () => {
  const { sessionsStore, sessionTurnState } = makeState();
  const session = makeSession("stop-order", {
    turns: [
      { id: "executing", state: 2, logs: [], finalResponse: "" },
      { id: "idle", state: 1, logs: [], finalResponse: "" },
    ],
  });
  sessionsStore.upsertHead(session);
  assert.equal(sessionTurnState.markStopped(session).id, "executing");
});
