export function createWorkspaceSessionController({
  getSession,
  workspaceViewStore,
  saveCurrentTargetAgent,
  saveCurrentSession,
  setSendAsNewSession = () => {},
  canSendToSession,
  canRestoreSession = () => false,
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
    // 选中会话代表用户要操作当前记录，必须清掉之前残留的“另开会话”意图。
    setSendAsNewSession(false);
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
        : canRestoreSession(session)
          ? t("session.readOnlySwitchBlocked")
          : t("session.readOnlyCannotRestore"));
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
