// 集中收纳跟 session 工作台直接相关的可变状态：
// - 工作台 sessions 数组、当前发送目标 sessionId、活跃 session 集合
// - stopped / deleted 墓碑 Set
// - 三个 UI flag 容器（latestOnly / flowDetailOpen / collapsedTurns）
// 模块本身不依赖 DOM、不直接驱动渲染。订阅 subscribe(listener) 后，状态发生变化时
// 调用方有机会自己触发渲染。这里刻意保持纯函数接口，方便单测以及未来切换到
// reactive UI。
//
// 注意：sessions 数组是 Store 的私有引用，外部读取通过 getSessionsSnapshot() 拿到数组快照。
// 任何 mutation 必须走显式方法，避免容器或字段从外部被偷偷改写。

export function createSessionsStore() {
  // sessions 数组只在 Store 内部持有稳定引用；外部读取数组快照并通过显式方法修改状态。
  const sessions = [];
  let currentSessionId = null;
  const activeSessionIds = new Set();
  const stoppedSessionIds = new Set();
  const deletedSessionIds = new Set();
  const flowDetailOpenState = new Map();
  const collapsedTurnState = new Map();
  const sessionLatestOnlyState = new Map();
  const listeners = new Set();
  let suppressNotify = 0;
  let pendingNotify = false;

  function notify() {
    if (suppressNotify > 0) {
      pendingNotify = true;
      return;
    }
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("sessionsStore listener threw:", error);
      }
    });
  }

  function batch(fn) {
    suppressNotify += 1;
    try {
      fn();
    } finally {
      suppressNotify -= 1;
      if (suppressNotify === 0 && pendingNotify) {
        pendingNotify = false;
        notify();
      }
    }
  }

  return {
    // ---- sessions array ----
    // 返回新的数组快照，避免调用方长期持有 Store 的内部容器并绕过 mutation 接口。
    getSessionsSnapshot() {
      return [...sessions];
    },
    getSession(id) {
      return id ? sessions.find((session) => session.id === id) || null : null;
    },
    replaceSessions(next) {
      sessions.length = 0;
      if (Array.isArray(next)) sessions.push(...next);
      notify();
    },
    upsertHead(session) {
      if (!session?.id) return;
      const idx = sessions.findIndex((item) => item.id === session.id);
      if (idx >= 0) sessions.splice(idx, 1);
      sessions.unshift(session);
      notify();
    },
    removeSessionById(id) {
      if (!id) return;
      let removed = false;
      for (let i = sessions.length - 1; i >= 0; i -= 1) {
        if (sessions[i].id === id) {
          sessions.splice(i, 1);
          removed = true;
        }
      }
      if (removed) notify();
    },
    filterSessions(predicate) {
      const next = sessions.filter(predicate);
      if (next.length === sessions.length) return;
      sessions.length = 0;
      sessions.push(...next);
      notify();
    },
    // 工作区可见性属于 Store 状态，View 与 Controller 不得直接改写 Session 对象。
    setWorkspaceVisibility(id, visible) {
      const session = id ? sessions.find((item) => item.id === id) : null;
      if (!session) return false;
      const next = Boolean(visible);
      if ((session.inWorkspace !== false) === next) return false;
      session.inWorkspace = next;
      notify();
      return true;
    },

    // ---- currentSessionId ----
    getCurrentSessionId() {
      return currentSessionId;
    },
    setCurrentSessionId(id) {
      const next = id || null;
      if (currentSessionId === next) return;
      currentSessionId = next;
      notify();
    },
    clearCurrentSessionIf(id) {
      if (id && currentSessionId === id) {
        currentSessionId = null;
        notify();
      }
    },

    // ---- activeSessionIds ----
    getActiveSessionIds() {
      return new Set(activeSessionIds);
    },
    isSessionActive(id) {
      return Boolean(id) && activeSessionIds.has(id);
    },
    markActive(id) {
      if (!id) return;
      const before = activeSessionIds.size;
      activeSessionIds.add(id);
      if (activeSessionIds.size !== before) notify();
    },
    markInactive(id) {
      if (!id) return;
      if (activeSessionIds.delete(id)) notify();
    },
    replaceActiveSessionIds(ids) {
      activeSessionIds.clear();
      (ids || []).forEach((id) => {
        if (id) activeSessionIds.add(id);
      });
      notify();
    },

    // ---- tombstones ----
    isSessionStopped(id) {
      return Boolean(id) && stoppedSessionIds.has(id);
    },
    markStopped(id) {
      if (!id) return;
      const before = stoppedSessionIds.size;
      stoppedSessionIds.add(id);
      if (stoppedSessionIds.size !== before) notify();
    },
    unmarkStopped(id) {
      if (!id) return;
      if (stoppedSessionIds.delete(id)) notify();
    },
    isSessionDeleted(id) {
      return Boolean(id) && deletedSessionIds.has(id);
    },
    markDeleted(id) {
      if (!id) return;
      const before = deletedSessionIds.size;
      deletedSessionIds.add(id);
      if (deletedSessionIds.size !== before) notify();
    },

    // ---- UI flags: latest only (per session) ----
    isLatestOnly(sessionId) {
      return sessionLatestOnlyState.get(sessionId) ?? false;
    },
    setLatestOnly(sessionId, value) {
      if (!sessionId) return;
      const next = Boolean(value);
      const prev = sessionLatestOnlyState.get(sessionId) ?? false;
      sessionLatestOnlyState.set(sessionId, next);
      if (prev !== next) notify();
    },
    deleteLatestOnly(sessionId) {
      if (sessionLatestOnlyState.delete(sessionId)) notify();
    },

    // ---- UI flags: flow detail open (key = `${turnId}:${kind}`) ----
    getFlowDetailOpen(key, defaultOpen = false) {
      return flowDetailOpenState.has(key) ? flowDetailOpenState.get(key) : defaultOpen;
    },
    setFlowDetailOpen(key, value) {
      if (!key) return;
      const next = Boolean(value);
      const prev = flowDetailOpenState.get(key);
      flowDetailOpenState.set(key, next);
      if (prev !== next) notify();
    },
    clearFlowDetailOpenForTurn(turnId) {
      if (!turnId) return;
      const prefix = `${turnId}:`;
      let removed = false;
      for (const key of flowDetailOpenState.keys()) {
        if (typeof key === "string" && key.startsWith(prefix)) {
          flowDetailOpenState.delete(key);
          removed = true;
        }
      }
      if (removed) notify();
    },

    // ---- UI flags: turn collapsed ----
    isTurnCollapsed(turnId, defaultCollapsed = false) {
      if (!turnId) return false;
      return collapsedTurnState.has(turnId) ? collapsedTurnState.get(turnId) : Boolean(defaultCollapsed);
    },
    setTurnCollapsed(turnId, value) {
      if (!turnId) return;
      const next = Boolean(value);
      const prev = collapsedTurnState.get(turnId);
      if (next === prev) return;
      collapsedTurnState.set(turnId, next);
      notify();
    },

    // ---- subscribe / batch ----
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    batch,

    // ---- reset (test helper) ----
    reset() {
      sessions.length = 0;
      currentSessionId = null;
      activeSessionIds.clear();
      stoppedSessionIds.clear();
      deletedSessionIds.clear();
      flowDetailOpenState.clear();
      collapsedTurnState.clear();
      sessionLatestOnlyState.clear();
      notify();
    },
  };
}
