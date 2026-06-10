import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeSessionCardView } from "./runtimeSessionCardView.js";

function createView(overrides = {}) {
  return createRuntimeSessionCardView({
    ensureSessionStatusShape() {},
    normalizeWorkspaceSession: (value) => value,
    resolveSessionCardControlState: () => ({
      statusView: {
        status: "completed",
        tone: "success",
        label: "完成",
        detail: "",
        icon: "check",
      },
      isWaiting: false,
      managementDisabled: false,
      canStop: false,
      canArchive: true,
      canRestore: false,
      actionDigest: "completed|success|active|interactive",
    }),
    getCurrentSessionId: () => "session-a",
    getFocusedSessionId: () => "session-a",
    projectRuntimeSessionMessageList: () => ({ rows: [], scrollTargetRowId: null }),
    runtimeSessionMessageListView: { renderMessageListShell: () => "<div data-runtime-message-scroller></div>" },
    sessionCardStats: () => [],
    isSessionLatestOnly: () => false,
    sessionIdentityTitle: () => "Demo - Win",
    renderSessionIdentityTitle: () => "Demo - Win",
    renderSessionActionIcon: () => "<svg></svg>",
    canRestoreSession: () => false,
    t: (key) => key,
    escapeHtml: (value) => String(value ?? ""),
    ...overrides,
  });
}

// 卡片和 mini card 必须消费同一份控制状态投影，避免 focused 与 active 显示分裂。
test("runtimeSessionCardView: focused and active state sync to card and mini card", () => {
  const session = {
    id: "session-a",
    task: "check architecture",
    turns: [],
    record_state: "active",
    access_mode: "interactive",
    runtime_binding: { state: "connected" },
  };
  const view = createView();

  assert.match(view.renderSessionCard(session), /session-card fullscreen is-active-receiver/);
  assert.match(view.renderSessionCard(session), /data-runtime-message-scroller/);
  assert.match(view.renderSessionMiniCard(session), /session-mini-card is-active/);
});

// 只读历史即使旧 turn 标着 running，也不能暴露停止或归档这类 live 操作。
test("runtimeSessionCardView: readonly history does not expose live management actions", () => {
  const session = {
    id: "session-history",
    task: "old transcript",
    turns: [{ id: "t1", status: "running" }],
    record_state: "active",
    access_mode: "read_only",
    runtime_binding: { state: "idle" },
  };
  const view = createView({
    getCurrentSessionId: () => "session-history",
    getFocusedSessionId: () => null,
    resolveSessionCardControlState: () => ({
      statusView: {
        status: "readonly_history",
        tone: "muted",
        label: "只读历史",
        detail: "不能直接续写",
        icon: "lock",
      },
      isWaiting: false,
      managementDisabled: false,
      canStop: false,
      canArchive: false,
      canRestore: false,
      actionDigest: "readonly_history|readonly_history|active|read_only",
    }),
  });

  const html = view.renderSessionCard(session);
  assert.doesNotMatch(html, /session-stop-btn/);
  assert.doesNotMatch(html, /session-archive-btn/);
  assert.match(html, /readonly_history/);
});

test("runtimeSessionCardView: live running session exposes waiting classes for animation", () => {
  const session = {
    id: "session-running",
    task: "run task",
    turns: [{ id: "t1", status: "running" }],
    record_state: "active",
    access_mode: "interactive",
    runtime_binding: { state: "connected" },
  };
  const view = createView({
    getCurrentSessionId: () => "session-running",
    getFocusedSessionId: () => null,
    resolveSessionCardControlState: () => ({
      statusView: {
        status: "running",
        tone: "busy",
        label: "运行中",
        detail: "处理中",
        icon: "spinner",
      },
      isWaiting: true,
      managementDisabled: false,
      canStop: true,
      canArchive: true,
      canRestore: false,
      actionDigest: "live|running|active|interactive",
    }),
  });

  const cardHtml = view.renderSessionCard(session);
  const miniHtml = view.renderSessionMiniCard(session);
  assert.match(cardHtml, /session-card[^"]*is-waiting/);
  assert.match(cardHtml, /session-card-status-pill session-status-busy session-status-running/);
  assert.doesNotMatch(cardHtml, /session-status-icon/);
  assert.match(cardHtml, /session-stop-btn/);
  assert.match(miniHtml, /session-mini-card[^"]*is-waiting/);
  assert.match(miniHtml, /session-status-running is-busy/);
});

test("runtimeSessionCardView: reconnecting session does not use running animation classes", () => {
  const session = {
    id: "session-restoring",
    task: "restore session",
    turns: [{ id: "t1", status: "completed" }],
    record_state: "active",
    access_mode: "interactive",
    runtime_binding: { state: "reconnecting", stage: "load" },
  };
  const view = createView({
    getCurrentSessionId: () => "session-restoring",
    getFocusedSessionId: () => null,
    resolveSessionCardControlState: () => ({
      statusView: {
        status: "reconnecting",
        tone: "busy",
        label: "重连中",
        detail: "正在恢复连接",
        icon: "spinner",
        secondary_status: { status: "completed", label: "上次已完成" },
      },
      isWaiting: false,
      isRestoring: true,
      managementDisabled: true,
      canStop: false,
      canArchive: true,
      canRestore: false,
      actionDigest: "live|reconnecting|active|interactive",
    }),
  });

  const cardHtml = view.renderSessionCard(session);
  const miniHtml = view.renderSessionMiniCard(session);
  assert.match(cardHtml, /session-status-reconnecting/);
  assert.match(cardHtml, /上次已完成/);
  assert.doesNotMatch(cardHtml, /session-card[^\"]*is-waiting/);
  assert.doesNotMatch(cardHtml, /session-stop-btn/);
  assert.doesNotMatch(cardHtml, /session-status-running/);
  assert.match(miniHtml, /session-status-reconnecting/);
  assert.doesNotMatch(miniHtml, /is-busy/);
});

test("runtimeSessionCardView: readonly stale running history has no waiting animation classes", () => {
  const session = {
    id: "session-history",
    task: "old transcript",
    turns: [{ id: "t1", status: "running" }],
    record_state: "active",
    access_mode: "read_only",
    runtime_binding: { state: "idle" },
  };
  const view = createView({
    getCurrentSessionId: () => "session-history",
    getFocusedSessionId: () => null,
    resolveSessionCardControlState: () => ({
      statusView: {
        status: "readonly_history",
        tone: "muted",
        label: "只读历史",
        detail: "只能查看",
        icon: "lock",
      },
      isWaiting: false,
      managementDisabled: false,
      canStop: false,
      canArchive: false,
      canRestore: false,
      actionDigest: "readonly_history|readonly_history|active|read_only",
    }),
  });

  const cardHtml = view.renderSessionCard(session);
  const miniHtml = view.renderSessionMiniCard(session);
  assert.doesNotMatch(cardHtml, /session-card[^"]*is-waiting/);
  assert.doesNotMatch(cardHtml, /session-status-running/);
  assert.doesNotMatch(cardHtml, /session-stop-btn/);
  assert.doesNotMatch(miniHtml, /is-busy/);
  assert.doesNotMatch(miniHtml, /session-status-running/);
});
