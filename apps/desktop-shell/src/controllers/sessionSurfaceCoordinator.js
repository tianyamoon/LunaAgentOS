// Session Surface Coordinator 将同一帧内的 Session 状态变化合并为一次界面提交。
// Store 只报告领域对象变化；协调器决定刷新 Card、顶部状态和右侧记录列表。
export function createSessionSurfaceCoordinator({
  sessionsStore,
  refreshSessionCard,
  scheduleSessionCardRender,
  shellSurface,
  requestFrame = (callback) => globalThis.requestAnimationFrame(callback),
} = {}) {
  const immediateCardIds = new Set();
  const deferredCardIds = new Set();
  let refreshWorkspaceStatus = false;
  let refreshHistory = false;
  let framePending = false;
  let disposed = false;

  function collectSessionIds(change, target = new Set()) {
    if (!change) return target;
    if (change.type === "session-updated" && change.sessionId) {
      target.add(change.sessionId);
      return target;
    }
    if (change.type === "batch") {
      (change.changes || []).forEach((item) => collectSessionIds(item, target));
    }
    return target;
  }

  function scheduleFlush() {
    if (disposed || framePending) return;
    framePending = true;
    requestFrame(flush);
  }

  function invalidate({
    sessionId,
    card = true,
    deferCard = false,
    workspaceStatus = true,
    history = true,
  } = {}) {
    if (card && sessionId) {
      if (deferCard && !immediateCardIds.has(sessionId)) {
        deferredCardIds.add(sessionId);
      } else {
        deferredCardIds.delete(sessionId);
        immediateCardIds.add(sessionId);
      }
    }
    refreshWorkspaceStatus ||= workspaceStatus;
    refreshHistory ||= history;
    scheduleFlush();
  }

  function flush() {
    framePending = false;
    if (disposed) return;

    immediateCardIds.forEach((sessionId) => {
      if (typeof refreshSessionCard === "function") {
        refreshSessionCard(sessionId);
      } else {
        scheduleSessionCardRender?.(sessionId);
      }
    });
    deferredCardIds.forEach((sessionId) => scheduleSessionCardRender?.(sessionId));
    immediateCardIds.clear();
    deferredCardIds.clear();

    const surfaceOptions = {
      workspaceStatus: refreshWorkspaceStatus,
      history: refreshHistory,
    };
    refreshWorkspaceStatus = false;
    refreshHistory = false;
    if (surfaceOptions.workspaceStatus || surfaceOptions.history) {
      shellSurface?.refresh(surfaceOptions);
    }
  }

  const unsubscribe = sessionsStore?.subscribe((change) => {
    collectSessionIds(change).forEach((sessionId) => invalidate({ sessionId }));
  }) || (() => {});

  return {
    invalidate,
    dispose() {
      disposed = true;
      immediateCardIds.clear();
      deferredCardIds.clear();
      unsubscribe();
    },
  };
}
