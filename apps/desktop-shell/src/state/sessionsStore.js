// 集中收纳跟 session 工作台直接相关的可变状态：
// - 工作台 sessions 数组、当前发送目标 sessionId、活跃 session 集合
// - stopped / deleted 墓碑 Set
// - 三个 UI flag 容器（latestOnly / flowDetailOpen / collapsedTurns）
// 模块本身不依赖 DOM、不直接驱动渲染。订阅 subscribe(listener) 后，状态发生变化时
// 调用方有机会自己触发渲染。这里刻意保持纯函数接口，方便单测以及未来切换到
// reactive UI。
//
// 注意：sessions 数组是 store 的私有引用，外部读取通过 getSessions() 拿到当前快照
// （不要长期持有），任何 mutation 必须走显式方法，避免状态从外部被偷偷改写。

export function createSessionsStore() {
  // sessions 数组持有 stable reference：所有 mutation 都通过 in-place 操作
  // （length=0 / splice / unshift / push）完成，外部消费者拿到这个数组的引用后
  // 可以一直保留，不需要担心 store 重新分配数组导致引用失效。
  const sessions = [];
  let currentSessionId = null;
  const activeSessionIds = new Set();
  const stoppedSessionIds = new Set();
  const deletedSessionIds = new Set();
  const flowDetailOpenState = new Map();
  const collapsedTurnIds = new Set();
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
    getSessions() {
      return sessions;
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
    isTurnCollapsed(turnId) {
      return Boolean(turnId) && collapsedTurnIds.has(turnId);
    },
    setTurnCollapsed(turnId, value) {
      if (!turnId) return;
      const next = Boolean(value);
      const prev = collapsedTurnIds.has(turnId);
      if (next === prev) return;
      if (next) collapsedTurnIds.add(turnId);
      else collapsedTurnIds.delete(turnId);
      notify();
    },

    // ---- stable references for legacy call sites ----
    // 这些方法返回 store 内部的真实容器引用，调用方不要长期持有这些引用做并发
    // 写入。它们存在的唯一目的是让旧代码（main.js 中 .has/.add/.delete/.find/
    // .filter 等大量读路径）可以拿到稳定的 reference 而不需要每个调用点改写。
    // 在迁移到 reactive UI 时可以收紧成只读视图。
    getSessionsRef() {
      return sessions;
    },
    getActiveSessionIdsRef() {
      return activeSessionIds;
    },
    getStoppedSessionIdsRef() {
      return stoppedSessionIds;
    },
    getDeletedSessionIdsRef() {
      return deletedSessionIds;
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
      collapsedTurnIds.clear();
      sessionLatestOnlyState.clear();
      notify();
    },
  };
}
