export function createWorkspaceSessionController({
  getSession,
  workspaceViewStore,
  saveCurrentTargetAgent,
  saveCurrentSession,
  canSendToSession,
  markSessionActive,
  shellSurface,
  sessionRuntimeState,
  setAppNotice,
  t,
}) {
  function focusSessionInWorkspace(sessionId) {
    const changed = workspaceViewStore.focusSession(sessionId);
    if (!changed) return false;
    shellSurface.refreshWorkspace();
    return true;
  }

  function toggleSessionFocus(sessionId) {
    const session = getSession(sessionId);
    if (!session) return false;
    const changed = workspaceViewStore.toggleFocus(sessionId);
    if (changed) shellSurface.refreshWorkspace();
    return changed;
  }

  function exitFullscreenSessions() {
    if (!workspaceViewStore.exitFocus()) return false;
    shellSurface.refreshWorkspace();
    setAppNotice(t("session.exitFullscreenNotice"));
    return true;
  }

  function activateWorkspaceSession(sessionId, options = {}) {
    const session = getSession(sessionId);
    if (!session) return false;
    saveCurrentTargetAgent(session.agentId);
    saveCurrentSession(session.id);
    workspaceViewStore.activateSession(session.id);
    if (canSendToSession(session)) markSessionActive(session.id);
    shellSurface.refresh({
      actions: true,
      providers: true,
      workspace: true,
      workspaceOptions: { focusSessionId: options.focusWorkspace ? session.id : null },
      history: true,
      historyOptions: { scrollSessionId: session.id },
    });
    const runtimeState = sessionRuntimeState(session);
    setAppNotice(canSendToSession(session)
      ? t("session.activated", { task: session.task })
      : runtimeState === "restoring"
        ? t("session.restoringFocused")
        : t("session.readOnlySwitchBlocked"));
    shellSurface.focusComposer();
    return true;
  }

  return {
    activateWorkspaceSession,
    exitFullscreenSessions,
    focusSessionInWorkspace,
    toggleSessionFocus,
  };
}
