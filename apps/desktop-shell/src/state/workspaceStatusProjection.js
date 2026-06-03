import {
  ACCESS_MODE,
  RECORD_STATE,
} from "./sessionStatus.js";

function activeRecordStateOf(session, sessionRecordState) {
  return sessionRecordState ? sessionRecordState(session) : (session?.record_state || RECORD_STATE.active);
}

function createdAtDesc(left, right) {
  return String(right?.createdAt || "").localeCompare(String(left?.createdAt || ""));
}

// 工作区空态只关心右侧是否还有可恢复的活跃历史，不直接碰 DOM。
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

// 顶部状态条的领域投影集中在这里，main.js 只负责渲染结果。
export function projectWorkspaceStatus({
  agent = null,
  provider = null,
  sessions = [],
  currentSession = null,
  latestActiveSession = null,
  availability = null,
  sessionRecordState = null,
  targetDisplayName = (target) => target?.name || target?.id || "",
} = {}) {
  if (!agent || !provider) {
    return {
      hasTarget: false,
      placeholderKey: "composer.placeholderNoTarget",
    };
  }

  const liveCount = sessions.filter((session) => activeRecordStateOf(session, sessionRecordState) === RECORD_STATE.active).length;
  const statusSession = pickWorkspaceStatusSession({
    currentSession,
    latestActiveSession,
    sessions,
    agentId: agent.id,
  });

  return {
    hasTarget: true,
    targetLabel: targetDisplayName(agent),
    statusState: statusSession?.state ?? agent.state ?? 1,
    availabilitySummary: availability?.summary || "unknown",
    liveCount,
  };
}
