export const WORKSPACE_VIEW_MODE = Object.freeze({
  grid: "grid",
  focused: "focused",
});

export function createWorkspaceViewStore(initial = {}) {
  let mode = initial.mode === WORKSPACE_VIEW_MODE.focused ? WORKSPACE_VIEW_MODE.focused : WORKSPACE_VIEW_MODE.grid;
  let focusedSessionId = initial.focusedSessionId || null;
  const listeners = new Set();

  if (mode !== WORKSPACE_VIEW_MODE.focused) focusedSessionId = null;
  if (mode === WORKSPACE_VIEW_MODE.focused && !focusedSessionId) mode = WORKSPACE_VIEW_MODE.grid;

  function notify() {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("workspaceViewStore listener threw:", error);
      }
    });
  }

  function setFocusedSession(sessionId) {
    const nextId = sessionId || null;
    const nextMode = nextId ? WORKSPACE_VIEW_MODE.focused : WORKSPACE_VIEW_MODE.grid;
    if (mode === nextMode && focusedSessionId === nextId) return false;
    mode = nextMode;
    focusedSessionId = nextId;
    notify();
    return true;
  }

  return {
    getMode() {
      return mode;
    },
    isFocusedMode() {
      return mode === WORKSPACE_VIEW_MODE.focused;
    },
    getFocusedSessionId() {
      return focusedSessionId;
    },
    focusSession(sessionId) {
      return setFocusedSession(sessionId);
    },
    activateSession(sessionId) {
      if (mode !== WORKSPACE_VIEW_MODE.focused) return false;
      return setFocusedSession(sessionId);
    },
    toggleFocus(sessionId) {
      if (mode === WORKSPACE_VIEW_MODE.focused && focusedSessionId === sessionId) {
        return setFocusedSession(null);
      }
      return setFocusedSession(sessionId);
    },
    exitFocus() {
      return setFocusedSession(null);
    },
    clearIfSessionRemoved(sessionId) {
      if (!sessionId || focusedSessionId !== sessionId) return false;
      return setFocusedSession(null);
    },
    hydrateFromSessions(sessions = []) {
      const fullscreenSession = sessions.find((session) => session?.fullscreen);
      return setFocusedSession(fullscreenSession?.id || null);
    },
    snapshot() {
      return { mode, focusedSessionId };
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      return setFocusedSession(null);
    },
  };
}
