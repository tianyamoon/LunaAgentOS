import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESS_MODE,
  CARD_STATUS,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
  SESSION_LIST_SIGNAL,
  SESSION_STATUS_KIND,
  TURN_STATUS,
  createRuntimeBinding,
  latestTurn,
  latestTurnOutcome,
  normalizeSessionStatusShape,
  resolveSessionCanonicalState,
  resolveSessionCardControlState,
  resolveSessionCardStatusView,
  statusFromRuntimeEvent,
  statusFromRuntimeStateCode,
} from "./sessionStatus.js";

const translate = (key) => ({
  "sessionStatus.waitingInput": "等待输入",
  "sessionStatus.waitingInputDetail": "可以继续输入",
  "sessionStatus.running": "运行中",
  "sessionStatus.runningDetail": "正在处理",
  "sessionStatus.waitingConfirmation": "等待确认",
  "sessionStatus.waitingConfirmationDetail": "需要确认",
  "sessionStatus.blocked": "受阻",
  "sessionStatus.blockedDetail": "连接受阻",
  "sessionStatus.failed": "失败",
  "sessionStatus.failedDetail": "运行失败",
  "sessionStatus.completed": "已完成",
  "sessionStatus.completedDetail": "已完成，可继续",
  "sessionStatus.archived": "已归档",
  "sessionStatus.archivedDetail": "已归档详情",
  "sessionStatus.readonlyHistory": "只读历史",
  "sessionStatus.readonlyHistoryDetail": "只读详情",
  "sessionStatus.secondary.completed": "上次已完成",
  "sessionStatus.secondary.failed": "上次失败",
  "sessionStatus.secondary.cancelled": "上次已取消",
  "sessionStatus.secondary.running": "上次仍在运行",
  "sessionStatus.secondary.waiting_confirmation": "上次等待确认",
  "sessionStatus.secondary.created": "尚未运行",
  "sessionStatus.error.defaultTitle": "Runtime 连接失败",
  "sessionStatus.error.defaultSuggestion": "检查后重试",
})[key] || key;

function session(overrides = {}) {
  return {
    id: "s1",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.interactive,
    runtime_binding: createRuntimeBinding(),
    turns: [],
    ...overrides,
  };
}

test("latestTurn and latestTurnOutcome read the latest turn execution fact", () => {
  const input = session({
    turns: [
      { id: "t1", status: TURN_STATUS.failed },
      { id: "t2", status: TURN_STATUS.completed },
    ],
  });
  assert.equal(latestTurn(input).id, "t2");
  assert.equal(latestTurnOutcome(input), TURN_STATUS.completed);
});

test("resolveSessionCardStatusView: empty interactive active session waits for input", () => {
  const view = resolveSessionCardStatusView(session(), { translate });
  assert.equal(view.status, CARD_STATUS.waiting_input);
  assert.equal(view.label, "等待输入");
  assert.equal(view.tone, "neutral");
});

test("resolveSessionCardStatusView: active turn states map to card states", () => {
  assert.equal(resolveSessionCardStatusView(session({ turns: [{ id: "t", status: TURN_STATUS.running }] }), { translate }).status, CARD_STATUS.running);
  assert.equal(resolveSessionCardStatusView(session({ turns: [{ id: "t", status: TURN_STATUS.waiting_confirmation }] }), { translate }).status, CARD_STATUS.waiting_confirmation);
  assert.equal(resolveSessionCardStatusView(session({ turns: [{ id: "t", status: TURN_STATUS.completed }] }), { translate }).status, CARD_STATUS.completed);
  assert.equal(resolveSessionCardStatusView(session({ turns: [{ id: "t", status: TURN_STATUS.failed }] }), { translate }).status, CARD_STATUS.failed);
  assert.equal(resolveSessionCardStatusView(session({ turns: [{ id: "t", status: TURN_STATUS.cancelled }] }), { translate }).status, CARD_STATUS.waiting_input);
});

test("resolveSessionCardStatusView: archived preserves latest outcome as secondary status", () => {
  const view = resolveSessionCardStatusView(session({
    record_state: RECORD_STATE.archived,
    turns: [{ id: "t", status: TURN_STATUS.completed }],
  }), { translate });
  assert.equal(view.status, CARD_STATUS.archived);
  assert.deepEqual(view.secondary_status, { status: TURN_STATUS.completed, label: "上次已完成" });
});

test("resolveSessionCardStatusView: read-only history wins over turn status", () => {
  const view = resolveSessionCardStatusView(session({
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.running }],
  }), { translate });
  assert.equal(view.status, CARD_STATUS.readonly_history);
  assert.equal(view.label, "只读历史");
  assert.equal(view.secondary_status, null);
});

test("resolveSessionCardStatusView: manual archive wins over read-only access", () => {
  const view = resolveSessionCardStatusView(session({
    record_state: RECORD_STATE.archived,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.completed }],
  }), { translate });

  assert.equal(view.status, CARD_STATUS.archived);
  assert.equal(view.secondary_status.status, TURN_STATUS.completed);
});

test("resolveSessionCanonicalState: read-only history is not live even when old turn says running", () => {
  const view = resolveSessionCanonicalState(session({
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.running }],
  }), {
    translate,
    canSendToSession: () => false,
  });

  assert.equal(view.kind, SESSION_STATUS_KIND.readonly_history);
  assert.equal(view.statusView.status, CARD_STATUS.readonly_history);
  assert.equal(view.listSignal, SESSION_LIST_SIGNAL.readonly_history);
  assert.equal(view.canSend, false);
  assert.equal(view.isRuntimeAttached, false);
});

test("resolveSessionCanonicalState: interactive completed session stays sendable", () => {
  const view = resolveSessionCanonicalState(session({
    turns: [{ id: "t", status: TURN_STATUS.completed, finalResponse: "done" }],
  }), {
    translate,
    canSendToSession: () => true,
  });

  assert.equal(view.kind, SESSION_STATUS_KIND.live);
  assert.equal(view.statusView.status, CARD_STATUS.completed);
  assert.equal(view.listSignal, SESSION_LIST_SIGNAL.live);
  assert.equal(view.canSend, true);
  assert.equal(view.isRuntimeAttached, true);
});

test("resolveSessionCanonicalState: manual archive remains archive bucket", () => {
  const view = resolveSessionCanonicalState(session({
    record_state: RECORD_STATE.archived,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.completed, finalResponse: "done" }],
  }), {
    translate,
    canSendToSession: () => false,
  });

  assert.equal(view.kind, SESSION_STATUS_KIND.archived);
  assert.equal(view.statusView.status, CARD_STATUS.archived);
  assert.equal(view.listSignal, SESSION_LIST_SIGNAL.archived);
  assert.equal(view.canSend, false);
});

test("resolveSessionCardControlState: read-only history disables live actions", () => {
  const controls = resolveSessionCardControlState(session({
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.running }],
  }), {
    translate,
    canSendToSession: () => false,
  });

  assert.equal(controls.statusView.status, CARD_STATUS.readonly_history);
  assert.equal(controls.isWaiting, false);
  assert.equal(controls.canStop, false);
  assert.equal(controls.canArchive, false);
});

test("resolveSessionCardControlState: interactive running session exposes stop and archive", () => {
  const controls = resolveSessionCardControlState(session({
    turns: [{ id: "t", status: TURN_STATUS.running }],
  }), {
    translate,
    canSendToSession: () => true,
  });

  assert.equal(controls.statusView.status, CARD_STATUS.running);
  assert.equal(controls.isWaiting, true);
  assert.equal(controls.canStop, true);
  assert.equal(controls.canArchive, true);
});

test("resolveSessionCardControlState: archived transcript is restorable but not archivable", () => {
  const controls = resolveSessionCardControlState(session({
    record_state: RECORD_STATE.archived,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t", status: TURN_STATUS.completed, finalResponse: "done" }],
  }), {
    translate,
    canRestoreSession: () => true,
  });

  assert.equal(controls.statusView.status, CARD_STATUS.archived);
  assert.equal(controls.canArchive, false);
  assert.equal(controls.canRestore, true);
});

test("resolveSessionCardStatusView: runtime resume failure is blocked with error detail", () => {
  const view = resolveSessionCardStatusView(session({
    runtime_binding: createRuntimeBinding({
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.resume,
      error_title: "Hermes 会话恢复失败",
      error_detail: "stdout closed",
      error_suggestion: "检查 profile 后重试",
    }),
    turns: [{ id: "t", status: TURN_STATUS.completed }],
  }), { translate });
  assert.equal(view.status, CARD_STATUS.blocked);
  assert.equal(view.error.title, "Hermes 会话恢复失败");
  assert.equal(view.error.stage, RUNTIME_BINDING_STAGE.resume);
  assert.equal(view.error.detail, "stdout closed");
});

test("resolveSessionCardStatusView: reconnecting runtime is visible as running before a turn exists", () => {
  const view = resolveSessionCardStatusView(session({
    runtime_binding: createRuntimeBinding({
      state: RUNTIME_BINDING_STATE.reconnecting,
      stage: RUNTIME_BINDING_STAGE.load,
    }),
    turns: [],
  }), { translate });
  assert.equal(view.status, CARD_STATUS.running);
  assert.equal(view.tone, "busy");
});

test("resolveSessionCardStatusView: runtime exit mid-session is blocked, not failed", () => {
  const view = resolveSessionCardStatusView(session({
    runtime_binding: createRuntimeBinding({
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.runtime,
      error_title: "Hermes runtime has exited",
      error_detail: "alive probe failed",
    }),
    turns: [{ id: "t", status: TURN_STATUS.completed }],
  }), { translate });
  assert.equal(view.status, CARD_STATUS.blocked);
  assert.equal(view.error.stage, RUNTIME_BINDING_STAGE.runtime);
});

test("resolveSessionCardStatusView: prompt failure is failed with error detail", () => {
  const view = resolveSessionCardStatusView(session({
    runtime_binding: createRuntimeBinding({
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.prompt,
      error_detail: "prompt failed",
    }),
  }), { translate });
  assert.equal(view.status, CARD_STATUS.failed);
  assert.equal(view.error.title, "Runtime 连接失败");
});

test("statusFromRuntimeStateCode maps legacy numeric runtime state to turn.status", () => {
  assert.equal(statusFromRuntimeStateCode(0), TURN_STATUS.running);
  assert.equal(statusFromRuntimeStateCode(4), TURN_STATUS.running);
  assert.equal(statusFromRuntimeStateCode(4, true), TURN_STATUS.running);
  assert.equal(statusFromRuntimeStateCode(5), TURN_STATUS.completed);
  assert.equal(statusFromRuntimeStateCode(6), TURN_STATUS.cancelled);
  assert.equal(statusFromRuntimeStateCode(9), TURN_STATUS.failed);
});

test("statusFromRuntimeEvent detects approvals, failures, completion and active stream events", () => {
  assert.equal(statusFromRuntimeEvent({ type: "tool", payload: { status: "waiting_confirmation" } }), TURN_STATUS.waiting_confirmation);
  assert.equal(statusFromRuntimeEvent({ type: "tool", payload: { status: "failed" } }), TURN_STATUS.running);
  assert.equal(statusFromRuntimeEvent({ type: "state", state: 5 }), TURN_STATUS.completed);
  assert.equal(statusFromRuntimeEvent({ type: "response", payload: { content: "x" } }), TURN_STATUS.running);
  assert.equal(statusFromRuntimeEvent({ type: "tool", payload: { status: "done" } }), TURN_STATUS.running);
});

test("normalizeSessionStatusShape initializes missing session and turn status fields", () => {
  const input = { id: "s", turns: [{ id: "t", state: 5, finalResponse: "done" }] };
  normalizeSessionStatusShape(input);
  assert.equal(input.record_state, RECORD_STATE.active);
  assert.equal(input.access_mode, ACCESS_MODE.interactive);
  assert.equal(input.runtime_binding.state, RUNTIME_BINDING_STATE.idle);
  assert.equal(input.turns[0].status, TURN_STATUS.completed);
});
