// 当前发送目标的切换策略集中在这里，避免 main.js 同时理解 Target、Session 与 View 刷新。
export function createCurrentTargetController({
  agentById,
  isTargetSelectable,
  targetSendBlockNotice,
  saveCurrentTargetAgent,
  getCurrentTargetAgent,
  getCurrentTargetProvider,
  getCurrentSession,
  saveCurrentSession,
  setSendAsNewSession,
  shellSurface,
  setAppNotice,
  targetDisplayName,
  t,
}) {
  function setCurrentTargetAgent(agentId) {
    const target = agentById(agentId);
    if (!isTargetSelectable(target)) {
      setAppNotice(targetSendBlockNotice(target), "error");
      shellSurface.refresh({ providers: true, actions: true });
      return false;
    }

    const previousSession = getCurrentSession();
    saveCurrentTargetAgent(agentId);
    const agent = getCurrentTargetAgent();
    const provider = getCurrentTargetProvider();
    if (previousSession && previousSession.agentId !== agentId) {
      saveCurrentSession(null);
      setSendAsNewSession(true);
    } else if (!getCurrentSession()) {
      setSendAsNewSession(true);
    }

    shellSurface.refreshActions();
    if (agent && provider) {
      shellSurface.refreshWorkspaceStatus();
      setAppNotice(t("target.switched", { target: targetDisplayName(agent) }));
    }
    shellSurface.refresh({
      providers: true,
      workspace: true,
      history: true,
      focusComposer: true,
    });
    return true;
  }

  return { setCurrentTargetAgent };
}
