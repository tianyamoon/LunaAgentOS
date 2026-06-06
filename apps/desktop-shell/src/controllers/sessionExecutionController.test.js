import test from "node:test";
import assert from "node:assert/strict";
import { createShellSurface } from "../ui/shellSurface.js";
import { createSessionExecutionController } from "./sessionExecutionController.js";

// 创建可观察执行副作用的控制器。
function makeHarness({ prompt, capabilities = {}, fallbackSessions = {}, tombstoned = false } = {}) {
  const session = { id: "s1", providerId: "demo", agentId: "a1", agentName: "Demo", turns: [] };
  const turn = { id: "t1", task: "task", logs: [], outputs: [], finalResponse: "", status: "running" };
  session.turns.push(turn);
  const calls = [];
  const shellSurface = createShellSurface({
    updateActionLabels: () => calls.push("labels"),
    renderProviders: () => calls.push("providers"),
    renderWorkspace: () => calls.push("workspace"),
    renderHistory: () => calls.push("history"),
  });
  const controller = createSessionExecutionController({
    getSession: () => session,
    getAgent: () => ({}),
    getAdapterCapabilities: () => capabilities,
    fallbackSessions,
    acpRuntimeClient: {
      canHandle: () => true,
      prompt: prompt || (async () => [{ type: "response", state: 5, payload: { content: "done" } }]),
    },
    sessionTurnState: {
      beginPromptRun: (_session, _turn, promptRunId) => {
        session.activePromptRunId = promptRunId;
        turn.promptRunId = promptRunId;
      },
      endPromptRun: () => {
        session.activePromptRunId = null;
      },
      updateTurnFromEvents: (_sessionId, _turnId, _promptRunId, events) => {
        const response = events.find((event) => event.type === "response");
        turn.finalResponse = response?.payload?.content || "";
        turn.outputs = turn.finalResponse ? [turn.finalResponse] : [];
        turn.status = events.some((event) => event.state === 9) ? "failed" : "completed";
        return turn;
      },
      appendStreamEvent: (_sessionId, _turnId, _promptRunId, event) => {
        turn.status = event.type === "thought" ? "running" : turn.status;
        return { session, turn };
      },
      // 启动提示必须经过统一 Runtime Log API，才能同时进入旧日志和新 Timeline。
      appendRuntimeLog: (_session, message) => {
        turn.logs = [message, ...turn.logs];
      },
      markPromptError: (_session, _turn, message) => { turn.error = message; turn.status = "failed"; },
    },
    sessionRuntimeState: {
      isSessionDeletedTombstone: () => tombstoned,
      isSessionStoppedTombstone: () => false,
      setRuntimeBinding: () => {},
      clearRuntimeBindingError: () => {},
    },
    saveTurnToHistory: async () => calls.push("save"),
    rollbackFirstTurnPromptFailure: (_session, _turn, message) => calls.push(`rollback:${message}`),
    refreshRuntimeTargets: async () => calls.push("refresh"),
    shellSurface,
    scheduleSessionCardRender: () => calls.push("schedule"),
    formatBackendError: (error) => error.message,
    setAppNotice: () => {},
    t: (key) => key,
    pumpFollowUpQueue: () => calls.push("pump"),
  });
  return { controller, session, turn, calls };
}

test("sessionExecutionController: ACP success saves turn", async () => {
  const { controller, session, turn, calls } = makeHarness();
  await controller.startAcpSession(session, turn);
  assert.equal(turn.finalResponse, "done");
  assert.equal(calls.includes("save"), true);
});

test("sessionExecutionController: ACP error is persisted", async () => {
  const { controller, session, turn, calls } = makeHarness({ prompt: async () => { throw new Error("boom"); } });
  await controller.startAcpSession(session, turn);
  assert.equal(turn.error, "boom");
  assert.equal(calls.includes("save"), true);
});

test("sessionExecutionController: stream event schedules card render", () => {
  const { controller, calls } = makeHarness();
  controller.appendStreamEvent("s1", "t1", "run-1", { type: "thought", payload: { content: "x" } });
  assert.equal(calls.includes("schedule"), true);
});

test("sessionExecutionController: final batch refresh keeps workspace container stable", () => {
  const { controller, session, turn, calls } = makeHarness();
  session.activePromptRunId = "run-1";
  turn.promptRunId = "run-1";
  controller.updateTurnFromEvents("s1", "t1", "run-1", [{ type: "response", state: 5, payload: { content: "done" } }]);
  assert.equal(calls.includes("schedule"), true);
  assert.equal(calls.includes("history"), true);
  assert.equal(calls.includes("workspace"), false);
});

test("sessionExecutionController: prompt error refresh keeps workspace container stable", () => {
  const { controller, calls } = makeHarness();
  controller.appendErrorToTurn("s1", "t1", "boom");
  assert.equal(calls.includes("schedule"), true);
  assert.equal(calls.includes("history"), true);
  assert.equal(calls.includes("workspace"), false);
});

test("sessionExecutionController: manifest capability controls target refresh", async () => {
  const { controller, session, turn, calls } = makeHarness({ capabilities: { refreshTargetsAfterPrompt: true } });
  await controller.startAcpSession(session, turn);
  assert.equal(calls.includes("refresh"), true);
});

test("sessionExecutionController: startup notice comes from manifest metadata", async () => {
  const { controller, session, turn } = makeHarness({
    capabilities: { startupNotice: { prefix: "Demo", identityField: "profileName", messageKey: "runtime.starting" } },
  });
  session.profileName = "default";
  await controller.startAcpSession(session, turn);
  assert.equal(turn.logs[0], "Demo default runtime.starting");
});

test("sessionExecutionController: fallback execution localizes and saves events", async () => {
  const { controller, session, turn, calls } = makeHarness({
    fallbackSessions: { demo: { events: [{ type: "response", state: 5, contentKey: "fallback.done" }] } },
  });
  await controller.runFallbackSession(session, turn);
  assert.equal(turn.finalResponse, "fallback.done");
  assert.equal(calls.includes("save"), true);
});

test("sessionExecutionController: restored first-turn error triggers rollback", async () => {
  const { controller, session, turn, calls } = makeHarness({ prompt: async () => { throw new Error("boom"); } });
  session.resume_validation = { phase: "pending", turn_id: null };
  await controller.startAcpSession(session, turn);
  assert.equal(calls.includes("rollback:boom"), true);
});

test("sessionExecutionController: tombstoned session ignores late ACP result", async () => {
  const { controller, session, turn, calls } = makeHarness({ tombstoned: true });
  await controller.startAcpSession(session, turn);
  assert.equal(calls.includes("save"), false);
});

test("sessionExecutionController: ACP 成功后才泵下一条 follow-up", async () => {
  const { controller, session, turn, calls } = makeHarness();
  await controller.startAcpSession(session, turn);
  assert.equal(calls.includes("pump"), true);
});

test("sessionExecutionController: ACP 失败后不会自动发送 follow-up", async () => {
  const { controller, session, turn, calls } = makeHarness({ prompt: async () => { throw new Error("boom"); } });
  await controller.startAcpSession(session, turn);
  assert.equal(calls.includes("pump"), false);
});
