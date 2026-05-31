import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHistoryEntryPayload,
  upsertHistoryEntry,
  formatCompactHistoryNotice,
} from "./payload.js";

const stateNames = { 5: "DONE", 9: "ERROR" };
const getStateName = (state) => stateNames[state];

function makeSession(overrides = {}) {
  return {
    id: "session-1",
    providerId: "claude",
    providerName: "Claude Code",
    agentId: "claude-main",
    agentName: "Claude Code",
    targetId: "claude-main",
    targetName: "Claude Code",
    runtimeInstanceId: null,
    runtimeLabel: null,
    runtimeHost: null,
    runtimeCommand: null,
    profileExecutable: null,
    acpSessionId: null,
    record_state: "active",
    access_mode: "interactive",
    runtime_binding: { state: "connected", stage: null },
    ...overrides,
  };
}

function makeTurn(overrides = {}) {
  return {
    id: "turn-1",
    task: "task text",
    state: 5,
    status: "completed",
    finalResponse: null,
    outputs: [],
    logs: [],
    thoughts: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildHistoryEntryPayload: copies session/turn fields and falls back to default summary", () => {
  const payload = buildHistoryEntryPayload({
    session: makeSession(),
    turn: makeTurn(),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.equal(payload.schemaVersion, 5);
  assert.equal(payload.providerId, "claude");
  assert.equal(payload.sessionId, "session-1");
  assert.equal(payload.runtime_state, "live");
  assert.equal(payload.record_state, "active");
  assert.equal(payload.access_mode, "interactive");
  assert.deepEqual(payload.runtime_binding, { state: "connected", stage: null });
  assert.equal(payload.status, "completed");
  assert.equal(payload.summary, "消息已结束。");
  // 没有额外快照时，Turn 仍按原值透传。
  assert.equal(payload.turn.id, "turn-1");
  assert.equal(payload.turn.meta, undefined);
});

test("buildHistoryEntryPayload: prefers finalResponse > last output > first log for summary", () => {
  const payloadFinal = buildHistoryEntryPayload({
    session: makeSession(),
    turn: makeTurn({ finalResponse: "final-text" }),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.equal(payloadFinal.summary, "final-text");

  const payloadOutputs = buildHistoryEntryPayload({
    session: makeSession(),
    turn: makeTurn({ outputs: ["a", "b"] }),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.equal(payloadOutputs.summary, "b");

  const payloadLogs = buildHistoryEntryPayload({
    session: makeSession(),
    turn: makeTurn({ logs: ["log-1", "log-2"] }),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.equal(payloadLogs.summary, "log-1");
});

test("buildHistoryEntryPayload: agentEntrySnapshot is stored without mutating turn.meta", () => {
  const snapshot = { agentId: "hermes-default", metadata: { profileName: "default" } };
  const payload = buildHistoryEntryPayload({
    session: makeSession({ providerId: "hermes" }),
    turn: makeTurn({ meta: { foo: 1 } }),
    agentEntrySnapshot: snapshot,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.deepEqual(payload.agentEntrySnapshot, snapshot);
  assert.deepEqual(payload.turn.meta, { foo: 1 });
});

test("buildHistoryEntryPayload: targetId / targetName fall back to agent fields", () => {
  const payload = buildHistoryEntryPayload({
    session: makeSession({ targetId: undefined, targetName: undefined }),
    turn: makeTurn(),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
    getStateName,
  });
  assert.equal(payload.targetId, "claude-main");
  assert.equal(payload.targetName, "Claude Code");
});

test("buildHistoryEntryPayload: status defaults to UNKNOWN when status and getStateName are missing", () => {
  const payload = buildHistoryEntryPayload({
    session: makeSession(),
    turn: makeTurn({ state: 99, status: undefined }),
    agentEntrySnapshot: null,
    schemaVersion: 5,
    runtimeState: "live",
  });
  assert.equal(payload.status, "UNKNOWN");
});

test("upsertHistoryEntry: inserts a new entry at the head", () => {
  const entries = [
    { sessionId: "s1", turn: { id: "t1" } },
  ];
  const next = upsertHistoryEntry(entries, { sessionId: "s2", turn: { id: "t2" } });
  assert.equal(next.length, 2);
  assert.equal(next[0].sessionId, "s2");
  assert.equal(next[1].sessionId, "s1");
  // 原始数组保持不变。
  assert.equal(entries.length, 1);
});

test("upsertHistoryEntry: replaces an existing entry by historyTurnKey", () => {
  const original = { sessionId: "s1", turn: { id: "t1", finalResponse: "old" } };
  const updated = { sessionId: "s1", turn: { id: "t1", finalResponse: "new" } };
  const entries = [original, { sessionId: "s2", turn: { id: "t2" } }];
  const next = upsertHistoryEntry(entries, updated);
  assert.equal(next.length, 2);
  assert.equal(next[0].turn.finalResponse, "new");
  assert.equal(next[1].sessionId, "s2");
});

test("upsertHistoryEntry: gracefully handles non-array input", () => {
  const next = upsertHistoryEntry(null, { sessionId: "s1", turn: { id: "t1" } });
  assert.deepEqual(next, [{ sessionId: "s1", turn: { id: "t1" } }]);
});

test("formatCompactHistoryNotice: returns null when nothing to report", () => {
  assert.equal(formatCompactHistoryNotice(null), null);
  assert.equal(formatCompactHistoryNotice({}), null);
  assert.equal(
    formatCompactHistoryNotice({ removedCount: 0, upgradedCount: 0, skippedFiles: 0 }),
    null,
  );
});

test("formatCompactHistoryNotice: builds info notice on dedupe / upgrade", () => {
  const notice = formatCompactHistoryNotice({ removedCount: 2, upgradedCount: 1, skippedFiles: 0 });
  assert.equal(notice.kind, "info");
  assert.match(notice.message, /去重 2/);
  assert.match(notice.message, /升级 1/);
});

test("formatCompactHistoryNotice: switches to error kind when files were skipped", () => {
  const notice = formatCompactHistoryNotice({ removedCount: 0, upgradedCount: 0, skippedFiles: 3 });
  assert.equal(notice.kind, "error");
  assert.match(notice.message, /跳过损坏文件 3 个/);
});
