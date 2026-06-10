// Session Launch Controller 模块。
// 统一处理发送前校验、Session 创建或复用、附件 prompt 装配与执行路由。
import { attachmentStatus, buildPromptWithAttachments } from "../ui/composerAttachments.js";
import { snapshotAgentEntry } from "../providers/agentEntrySnapshot.js";
import { LIFECYCLE } from "../state/sessionLifecycle.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  createRuntimeBinding,
} from "../state/sessionStatus.js";

export function sessionTitleFromPrompt(prompt, maxLength = 80) {
  const firstNonEmptyLine = String(prompt || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
  const title = firstNonEmptyLine.replace(/\s+/g, " ");
  return title.length > maxLength ? title.slice(0, maxLength) : title;
}

// 创建发送入口控制器。Shell 仅注入环境能力，控制器不理解具体 Adapter。
export function createSessionLaunchController({
  getPromptValue,
  clearPrompt,
  getComposerAttachments,
  clearComposerAttachments,
  getCurrentTargetAgent,
  getCurrentTargetProvider,
  providerById,
  targetDisplayName,
  canTargetStartSession,
  targetSendBlockNotice,
  canSendToProvider,
  providerAvailability,
  providerAvailabilityLabel,
  getCurrentSession,
  canRestoreSession = () => false,
  currentSessionSendBlockReason,
  normalizeWorkspaceSession,
  upsertSession,
  markSessionActive,
  isSessionActive,
  saveCurrentSession,
  unmarkStopped,
  createSessionTurn,
  sessionPromptQueue,
  shellSurface,
  setSendAsNewSession,
  isTargetActivatable,
  acpCommandsForProvider,
  startAcpSession,
  runFallbackSession,
  setAppNotice,
  t,
  defaultModelForTarget = () => "",
  now = () => Date.now(),
}) {
  let sessionSeq = 0;

  // 创建通用 Runtime Session。Agent Entry 的 Adapter 差异只作为快照透传。
  function createSessionForAgent(agent, initialPrompt) {
    const provider = providerById(agent?.providerId);
    if (!agent || !provider) return null;

    sessionSeq += 1;
    const targetName = targetDisplayName(agent);
    const agentEntrySnapshot = snapshotAgentEntry(agent);
    const session = {
      id: `session-${now()}-${sessionSeq}`,
      providerId: provider.id,
      providerName: provider.name,
      agentId: agent.id,
      agentName: targetName,
      targetId: agent.id,
      targetName,
      runtimeInstanceId: agent.runtimeInstanceId || null,
      runtimeLabel: agent.runtimeLabel || null,
      runtimeHost: agent.runtimeHost || null,
      runtimeCommand: agent.runtimeCommand || null,
      profileExecutable: agentEntrySnapshot.launch.profileExecutable || null,
      defaultModel: agent.modelControl?.mode === "luna_managed" ? defaultModelForTarget(agent) || null : null,
      agentEntrySnapshot,
      title: sessionTitleFromPrompt(initialPrompt) || t("history.newSession"),
      state: 2,
      lifecycle: LIFECYCLE.live,
      runtimeState: LIFECYCLE.live,
      record_state: RECORD_STATE.active,
      access_mode: ACCESS_MODE.interactive,
      runtime_binding: createRuntimeBinding(),
      turns: [],
      createdAt: new Date(now()).toISOString(),
      acpStartupNoticeShown: false,
      inWorkspace: true,
    };
    Object.assign(session, normalizeWorkspaceSession(session));
    upsertSession(session);
    markSessionActive(session.id);
    shellSurface.refresh({ workspace: true, history: true });
    return session;
  }

  // 创建 Turn 后立即刷新工作区，使用户先看到已接收输入的反馈。
  function createTurn(session, prompt, options = {}) {
    const turn = createSessionTurn(session, prompt, options);
    shellSurface.refreshWorkspace();
    return turn;
  }

  // 优先复用当前可交互 Session；目标变化或 Session 失活时创建新会话。
  function getOrCreateActiveSession(prompt, forceNew = false) {
    const agent = getCurrentTargetAgent();
    if (!agent) return null;
    const existing = !forceNew ? getCurrentSession() : null;
    if (existing && existing.agentId !== agent.id) return createSessionForAgent(agent, prompt);
    if (existing && !isSessionActive(existing.id)) return createSessionForAgent(agent, prompt);
    return existing || createSessionForAgent(agent, prompt);
  }

  // 将附件投影为可持久化的轻量元数据，正文仅拼入本轮 runtime prompt。
  function attachmentMetadata(attachments) {
    return attachments.map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      status: attachmentStatus(attachment),
      truncated: Boolean(attachment.truncated),
    }));
  }

  // 从 Composer 启动一次发送。ACP 与 fallback 只在最后一步分流。
  function startSessionFromPrompt(forceNewSession = false) {
    const prompt = getPromptValue().trim();
    if (!prompt) {
      shellSurface.focusComposer();
      return null;
    }

    const agent = getCurrentTargetAgent();
    const provider = getCurrentTargetProvider();
    if (!agent || !provider) {
      setAppNotice(t("composer.needTargetBeforeSend"), "error");
      return null;
    }
    if (!canTargetStartSession(agent)) {
      setAppNotice(targetSendBlockNotice(agent), "error");
      shellSurface.focusComposer();
      return null;
    }
    if (!canSendToProvider(provider.id)) {
      const availability = providerAvailability(provider.id);
      const label = providerAvailabilityLabel(availability.summary);
      setAppNotice(t("composer.providerUnavailable", { provider: provider.name, state: label }), "error");
      return null;
    }

    const selectedSession = getCurrentSession();
    const selectedSessionActive = selectedSession ? isSessionActive(selectedSession.id) : false;
    // 是否另开会话只能来自用户显式操作，不能由 inactive/failed 等运行状态反推。
    const explicitNewSession = Boolean(forceNewSession);
    const selectedSessionReadOnly = selectedSession?.access_mode === ACCESS_MODE.read_only;
    const selectedSessionDetached = Boolean(selectedSession && !selectedSessionActive);
    const explicitNewFromDetached = Boolean(selectedSessionDetached && !selectedSessionReadOnly && explicitNewSession);
    const explicitNewFromHistory = Boolean(selectedSessionReadOnly && explicitNewSession);
    // 只读历史不能被普通发送隐式续写；用户必须明确选择“另开会话”。
    if (selectedSessionReadOnly && !explicitNewSession) {
      setAppNotice(
        canRestoreSession(selectedSession)
          ? t("session.readOnlySwitchBlocked")
          : t("session.readOnlyCannotRestore"),
        "error",
      );
      shellSurface.focusComposer();
      return null;
    }
    const composingNewSession = explicitNewSession || !selectedSession;
    const blockReason = !composingNewSession ? currentSessionSendBlockReason(selectedSession, agent) : "";
    if (blockReason) {
      setAppNotice(blockReason, "error");
      shellSurface.focusComposer();
      return null;
    }

    const session = getOrCreateActiveSession(prompt, composingNewSession);
    if (!session) return null;
    saveCurrentSession(session.id);
    unmarkStopped(session.id);
    const attachments = getComposerAttachments();
    const runtimePrompt = buildPromptWithAttachments(prompt, attachments, {
      title: t("composer.attachment.promptTitle"),
      truncated: t("composer.attachment.truncated"),
    });
    const submission = sessionPromptQueue.submit(session, prompt, {
      runtimePrompt,
      attachments: attachmentMetadata(attachments),
    });
    clearPrompt();
    clearComposerAttachments();
    setSendAsNewSession(false);
    shellSurface.refreshActions();
    if (explicitNewFromHistory) {
      setAppNotice(t("session.startedNewFromHistory", { target: targetDisplayName(agent) }), "busy");
    } else if (explicitNewFromDetached) {
      setAppNotice(t("session.startedNewFromDetached", { target: targetDisplayName(agent) }), "busy");
    } else if (isTargetActivatable(agent)) {
      setAppNotice(t("runtime.activatingTarget", { target: targetDisplayName(agent) }), "busy");
    }
    return { session, ...submission };
  }

  return {
    createSessionForAgent,
    createTurn,
    getOrCreateActiveSession,
    startSessionFromPrompt,
  };
}
