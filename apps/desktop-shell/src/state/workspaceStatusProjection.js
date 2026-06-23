import {
  ACCESS_MODE,
  RECORD_STATE,
  resolveSessionCanonicalState as defaultResolveSessionCanonicalState,
} from "./sessionStatus.js";

function createdAtDesc(left, right) {
  return String(right?.createdAt || "").localeCompare(String(left?.createdAt || ""));
}

function fallbackCanonicalState(session, {
  sessionRecordState = null,
  resolveSessionStatusView = null,
  translate = null,
} = {}) {
  const recordState = sessionRecordState
    ? sessionRecordState(session)
    : (session?.record_state || RECORD_STATE.active);
  const accessMode = session?.access_mode || ACCESS_MODE.interactive;
  const isArchived = recordState === RECORD_STATE.archived;
  const isDeleted = recordState === RECORD_STATE.deleted;
  const isReadOnly = accessMode === ACCESS_MODE.read_only;

  return {
    recordState,
    accessMode,
    statusView: typeof resolveSessionStatusView === "function"
      ? resolveSessionStatusView(session, { translate })
      : null,
    isRuntimeAttached: recordState === RECORD_STATE.active && !isArchived && !isDeleted && !isReadOnly,
  };
}

function canonicalStateForSession(session, {
  resolveSessionCanonicalState = defaultResolveSessionCanonicalState,
  canSendToSession = null,
  canRestoreSession = null,
  sessionRecordState = null,
  resolveSessionStatusView = null,
  translate = null,
} = {}) {
  if (typeof resolveSessionCanonicalState === "function") {
    return resolveSessionCanonicalState(session, {
      translate,
      canSendToSession,
      canRestoreSession,
    });
  }

  return fallbackCanonicalState(session, {
    sessionRecordState,
    resolveSessionStatusView,
    translate,
  });
}

// 工作区空态只关心右侧是否还有可恢复的活跃历史，不直接触碰 DOM。
export function countRestorableActiveHistoryItems({ sessions = [], archivedSessions = [] } = {}) {
  const liveIds = new Set(sessions.map((session) => session.id));
  return archivedSessions
    .filter((item) => !liveIds.has(item.id))
    .filter((item) => item.record_state === RECORD_STATE.active && item.access_mode !== ACCESS_MODE.read_only)
    .length;
}

export function projectWorkspaceEmptyCopy({ restorableCount = 0 } = {}) {
  if (restorableCount > 0) {
    return {
      titleKey: "workspace.emptyRestoreTitle",
      textKey: "workspace.emptyRestoreText",
    };
  }
  return {
    titleKey: "workspace.emptyTitle",
    textKey: "workspace.emptyText",
  };
}

export function pickWorkspaceStatusSession({
  currentSession = null,
  latestActiveSession = null,
  sessions = [],
  agentId = null,
} = {}) {
  if (currentSession) return currentSession;
  if (latestActiveSession) return latestActiveSession;
  return sessions
    .filter((session) => session.agentId === agentId)
    .sort(createdAtDesc)[0] || null;
}

// 顶部状态条只消费 canonical session 状态，避免与卡片、右侧列表各自推断。
export function projectWorkspaceStatus({
  agent = null,
  provider = null,
  sessions = [],
  currentSession = null,
  latestActiveSession = null,
  availability = null,
  sessionRecordState = null,
  resolveSessionStatusView = null,
  resolveSessionCanonicalState = defaultResolveSessionCanonicalState,
  canSendToSession = null,
  canRestoreSession = null,
  translate = null,
  targetDisplayName = (target) => target?.name || target?.id || "",
} = {}) {
  if (!agent || !provider) {
    return {
      hasTarget: false,
      placeholderKey: "composer.placeholderNoTarget",
    };
  }

  const canonicalOptions = {
    resolveSessionCanonicalState,
    canSendToSession,
    canRestoreSession,
    sessionRecordState,
    resolveSessionStatusView,
    translate,
  };
  const liveCount = sessions
    .filter((session) => canonicalStateForSession(session, canonicalOptions).isRuntimeAttached)
    .length;
  const statusSession = pickWorkspaceStatusSession({
    currentSession,
    latestActiveSession,
    sessions,
    agentId: agent.id,
  });
  const statusCanonical = statusSession
    ? canonicalStateForSession(statusSession, canonicalOptions)
    : null;

  return {
    hasTarget: true,
    targetLabel: targetDisplayName(agent),
    statusState: statusSession?.state ?? agent.state ?? 1,
    sessionStatusView: statusCanonical?.statusView || null,
    availabilitySummary: availability?.summary || "unknown",
    liveCount,
  };
}
