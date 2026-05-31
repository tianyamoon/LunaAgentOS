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
  sessionTurnState.updateTurnFromEvents(session.id, turn.id, [
    { type: "response", state: 5, payload: { content: "done" } },
  ]);
  assert.equal(turn.finalResponse, "done");
  assert.equal(turn.status, TURN_STATUS.completed);
  sessionTurnState.appendStreamEvent(session.id, {
    type: "tool",
    payload: { title: "Read", status: "ok" },
  });
  assert.match(turn.logs[0], /Read/);
});

test("sessionTurnState: tombstones block late stream events", () => {
  const { sessionsStore, sessionRuntimeState, sessionTurnState } = makeState();
  const session = makeSession("stopped");
  sessionsStore.upsertHead(session);
  const turn = sessionTurnState.createTurn(session, "task");
  sessionRuntimeState.setSessionLifecycle(session, "stopped");
  assert.equal(sessionTurnState.appendStreamEvent(session.id, {
    type: "response",
    payload: { content: "late" },
  }), null);
  assert.notEqual(turn.finalResponse, "late");
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
  assert.equal(sessionsStore.getFlowDetailOpen(`${turn.id}:logs`), true);
  sessionTurnState.markStopped(session);
  assert.equal(turn.state, 6);
  assert.equal(turn.finalResponse, "turn.stoppedResponse");
  assert.equal(session.state, 6);
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
