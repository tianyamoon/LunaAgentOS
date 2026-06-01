import test from "node:test";
import assert from "node:assert/strict";

import { createRuntimeSessionCardView } from "./runtimeSessionCardView.js";

// 渲染测试使用稳定投影桩，专注验证 Card 与 mini card 是否共享焦点状态。
test("runtimeSessionCardView: focused 与 active 状态同步到主卡和 mini card", () => {
  const session = {
    id: "session-a",
    task: "检查架构",
    turns: [],
    record_state: "active",
    access_mode: "interactive",
    runtime_binding: { state: "connected" },
  };
  const view = createRuntimeSessionCardView({
    ensureSessionStatusShape() {},
    normalizeWorkspaceSession: (value) => value,
    resolveSessionCardStatusView: () => ({
      status: "completed",
      tone: "success",
      label: "完成",
      detail: "",
      icon: "check",
    }),
    getCurrentSessionId: () => "session-a",
    getFocusedSessionId: () => "session-a",
    projectRuntimeSessionMessageList: () => ({ rows: [], scrollTargetRowId: null }),
    runtimeSessionMessageListView: { renderMessageListShell: () => "<div data-runtime-message-scroller></div>" },
    sessionCardStats: () => [],
    isSessionLatestOnly: () => false,
    flowDetailEntriesForSession: () => [],
    areSessionFlowDetailsOpen: () => false,
    areSessionTurnsCollapsed: () => false,
    sessionIdentityTitle: () => "Demo · Win",
    renderSessionIdentityTitle: () => "Demo · Win",
    renderSessionActionIcon: () => "<svg></svg>",
    canRestoreSession: () => false,
    CARD_STATUS: { running: "running", waiting_confirmation: "waiting_confirmation" },
    RUNTIME_BINDING_STATE: { reconnecting: "reconnecting" },
    RECORD_STATE: { archived: "archived", active: "active" },
    ACCESS_MODE: { read_only: "read_only" },
    t: (key) => key,
    escapeHtml: (value) => String(value ?? ""),
  });

  assert.match(view.renderSessionCard(session), /session-card fullscreen is-active-receiver/);
  assert.match(view.renderSessionCard(session), /data-runtime-message-scroller/);
  assert.match(view.renderSessionMiniCard(session), /session-mini-card is-active/);
});
