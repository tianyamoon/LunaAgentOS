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
  updateActionLabels,
  renderProviders,
  renderWorkspaceStatus,
  renderWorkspace,
  renderHistory,
  setAppNotice,
  targetDisplayName,
  focusComposerInput,
  t,
}) {
  function setCurrentTargetAgent(agentId) {
    const target = agentById(agentId);
    if (!isTargetSelectable(target)) {
      setAppNotice(targetSendBlockNotice(target), "error");
      renderProviders();
      updateActionLabels();
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

    updateActionLabels();
    if (agent && provider) {
      renderWorkspaceStatus();
      setAppNotice(t("target.switched", { target: targetDisplayName(agent) }));
    }
    renderProviders();
    renderWorkspace();
    renderHistory();
    focusComposerInput();
    return true;
  }

  return { setCurrentTargetAgent };
}
