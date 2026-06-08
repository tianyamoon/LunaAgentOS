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
