export function createWorkspaceSessionController({
  sessions,
  workspaceViewStore,
  saveCurrentTargetAgent,
  saveCurrentSession,
  canSendToSession,
  markSessionActive,
  updateActionLabels,
  renderProviders,
  renderWorkspace,
  renderHistory,
  sessionRuntimeState,
  setAppNotice,
  focusComposerInput,
  t,
}) {
  function focusSessionInWorkspace(sessionId) {
    const changed = workspaceViewStore.focusSession(sessionId);
    if (!changed) return false;
    renderWorkspace();
    return true;
  }

  function toggleSessionFocus(sessionId) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return false;
    const changed = workspaceViewStore.toggleFocus(sessionId);
    if (changed) renderWorkspace();
    return changed;
  }

  function exitFullscreenSessions() {
    if (!workspaceViewStore.exitFocus()) return false;
    renderWorkspace();
    setAppNotice(t("session.exitFullscreenNotice"));
    return true;
  }

  function activateWorkspaceSession(sessionId, options = {}) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return false;
    saveCurrentTargetAgent(session.agentId);
    saveCurrentSession(session.id);
    workspaceViewStore.activateSession(session.id);
    if (canSendToSession(session)) markSessionActive(session.id);
    updateActionLabels();
    renderProviders();
    renderWorkspace({ focusSessionId: options.focusWorkspace ? session.id : null });
    renderHistory({ scrollSessionId: session.id });
    const runtimeState = sessionRuntimeState(session);
    setAppNotice(canSendToSession(session)
      ? t("session.activated", { task: session.task })
      : runtimeState === "restoring"
        ? t("session.restoringFocused")
        : t("session.readOnlySwitchBlocked"));
    focusComposerInput();
    return true;
  }

  return {
    activateWorkspaceSession,
    exitFullscreenSessions,
    focusSessionInWorkspace,
    toggleSessionFocus,
  };
}
