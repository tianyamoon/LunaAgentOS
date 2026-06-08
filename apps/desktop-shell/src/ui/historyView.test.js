import test from "node:test";
import assert from "node:assert/strict";
import {
  projectHistoryListItemState,
  resolveHistoryItemStatusSource,
  shouldRestoreActiveHistoryItem,
} from "./historyView.js";
import {
  ACCESS_MODE,
  CARD_STATUS,
  RECORD_STATE,
  TURN_STATUS,
  resolveSessionListPresentationState,
} from "../state/sessionStatus.js";

test("historyView: 已打开的只读活跃历史再次点击仍只导航回工作区", () => {
  const readOnlyExisting = { id: "s1", access_mode: "read_only" };
  assert.equal(shouldRestoreActiveHistoryItem(readOnlyExisting, () => false), false);
});

test("historyView: 可发送的现有会话点击时只需要激活", () => {
  const liveExisting = { id: "s1", access_mode: "interactive" };
  assert.equal(shouldRestoreActiveHistoryItem(liveExisting, () => true), false);
});

test("historyView: 不存在工作区会话时由原点击路径负责恢复", () => {
  assert.equal(shouldRestoreActiveHistoryItem(null, () => false), false);
});

test("historyView: 同 id live session 存在时状态源优先使用 live session", () => {
  const historyItem = { id: "s1", status: "completed" };
  const liveSession = { id: "s1", status: "running" };

  assert.equal(resolveHistoryItemStatusSource(historyItem, () => liveSession), liveSession);
});

test("historyView: 没有 live session 时状态源回退到历史 item", () => {
  const historyItem = { id: "s1", status: "completed" };

  assert.equal(resolveHistoryItemStatusSource(historyItem, () => null), historyItem);
});

test("historyView: read-only history with saved answer keeps completed status", () => {
  const projected = projectHistoryListItemState({
    id: "s1",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t1", status: TURN_STATUS.running, finalResponse: "done" }],
  }, {
    getSession: () => null,
    ensureSessionStatusShape: () => {},
    resolveSessionListPresentationState,
    canSendToSession: () => false,
    translate: (key) => key,
  });

  assert.equal(projected.statusView.status, CARD_STATUS.completed);
  assert.equal(projected.signalClass, "signal-archive");
  assert.equal(projected.isSendable, false);
  assert.equal(projected.listStateClass, "is-active-history");
});

test("historyView: read-only history without saved answer does not appear running", () => {
  const projected = projectHistoryListItemState({
    id: "s1",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "t1", status: TURN_STATUS.running }],
  }, {
    getSession: () => null,
    ensureSessionStatusShape: () => {},
    resolveSessionListPresentationState,
    canSendToSession: () => false,
    translate: (key) => key,
  });

  assert.equal(projected.statusView.status, CARD_STATUS.readonly_history);
  assert.equal(projected.signalClass, "signal-archive");
  assert.equal(projected.isSendable, false);
  assert.equal(projected.listStateClass, "is-active-history");
});

test("historyView: live session source wins over detached read-only history state", () => {
  const liveSession = {
    id: "s1",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.interactive,
    turns: [{ id: "t1", status: TURN_STATUS.completed, finalResponse: "done" }],
  };
  const projected = projectHistoryListItemState({
    id: "s1",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "old", status: TURN_STATUS.running }],
  }, {
    getSession: () => liveSession,
    ensureSessionStatusShape: () => {},
    resolveSessionListPresentationState,
    canSendToSession: () => true,
    translate: (key) => key,
  });

  assert.equal(projected.statusSource, liveSession);
  assert.equal(projected.statusView.status, CARD_STATUS.completed);
  assert.equal(projected.signalClass, "signal-active");
});
