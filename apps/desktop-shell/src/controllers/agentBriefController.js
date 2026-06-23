export function createAgentBriefController({
  isTargetSendable,
  acpCommandsForProvider,
  buildAgentBriefPrompt,
  createSessionForAgent,
  saveCurrentTargetAgent,
  saveCurrentSession,
  unmarkStopped,
  createTurn,
  closeConfirmDialog,
  shellSurface,
  startAcpSession,
  parseAgentBriefResponse,
  cloneAgentBriefs,
  writeBriefValue,
  saveAgentBriefRecords,
  targetDisplayName,
  setAppNotice,
  t,
} = {}) {
  // 自动获取职责简报本质上是一次隐藏的 Prompt Run，统一从这里编排。
  async function fetchAgentBriefForTarget(target) {
    if (!target || !isTargetSendable(target)) throw new Error(t("agentBrief.targetUnavailable"));
    const commands = acpCommandsForProvider(target.providerId);
    if (!commands?.prompt) throw new Error(t("agentBrief.autoUnsupported"));
    const prompt = buildAgentBriefPrompt();
    const session = createSessionForAgent(target, prompt);
    if (!session) throw new Error(t("agentBrief.autoUnsupported"));
    saveCurrentTargetAgent(target.id);
    saveCurrentSession(session.id);
    unmarkStopped(session.id);
    const turn = createTurn(session, prompt);
    closeConfirmDialog();
    shellSurface.refresh({
      providers: true,
      workspace: true,
      workspaceOptions: { scrollSessionId: session.id },
      history: true,
      historyOptions: { scrollSessionId: session.id },
    });
    await startAcpSession(session, turn);
    const response = turn.finalResponse || turn.outputs.join("\n");
    return parseAgentBriefResponse(response, { translate: t });
  }

  async function refreshAgentBriefForTarget(target, { quiet = false } = {}) {
    if (!target) return null;
    if (!quiet) setAppNotice(t("agentBrief.fetching", { target: targetDisplayName(target) }), "busy");
    const result = await fetchAgentBriefForTarget(target);
    const next = cloneAgentBriefs();
    writeBriefValue(next, target, "zh-CN", result["zh-CN"], "agent-session");
    writeBriefValue(next, target, "en-US", result["en-US"], "agent-session");
    await saveAgentBriefRecords(next);
    shellSurface.refreshProviders();
    if (!quiet) setAppNotice(t("agentBrief.fetched", { target: targetDisplayName(target) }));
    return result;
  }

  return {
    fetchAgentBriefForTarget,
    refreshAgentBriefForTarget,
  };
}
