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
  isComposingNewSession,
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
  now = () => Date.now(),
}) {
  let sessionSeq = 0;

  // 创建通用 Runtime Session。Agent Entry 的 Adapter 差异只作为快照透传。
  function createSessionForAgent(agent, firstTask) {
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
      agentEntrySnapshot,
      task: firstTask,
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

  // 创建 Turn 后立即刷新工作区，使用户先看到已接收任务的反馈。
  function createTurn(session, task, options = {}) {
    const turn = createSessionTurn(session, task, options);
    shellSurface.refreshWorkspace();
    return turn;
  }

  // 优先复用当前可交互 Session；目标变化或 Session 失活时创建新会话。
  function getOrCreateActiveSession(task, forceNew = false) {
    const agent = getCurrentTargetAgent();
    if (!agent) return null;
    const existing = !forceNew ? getCurrentSession() : null;
    if (existing && existing.agentId !== agent.id) return createSessionForAgent(agent, task);
    if (existing && !isSessionActive(existing.id)) return createSessionForAgent(agent, task);
    return existing || createSessionForAgent(agent, task);
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
    const task = getPromptValue().trim();
    if (!task) {
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
    const composingNewSession = forceNewSession || isComposingNewSession();
    const blockReason = !composingNewSession ? currentSessionSendBlockReason(selectedSession, agent) : "";
    if (blockReason) {
      setAppNotice(blockReason, "error");
      shellSurface.focusComposer();
      return null;
    }

    const session = getOrCreateActiveSession(task, composingNewSession);
    if (!session) return null;
    saveCurrentSession(session.id);
    unmarkStopped(session.id);
    const attachments = getComposerAttachments();
    const runtimePrompt = buildPromptWithAttachments(task, attachments, {
      title: t("composer.attachment.promptTitle"),
      truncated: t("composer.attachment.truncated"),
    });
    const submission = sessionPromptQueue.submit(session, task, {
      runtimePrompt,
      attachments: attachmentMetadata(attachments),
    });
    clearPrompt();
    clearComposerAttachments();
    setSendAsNewSession(false);
    shellSurface.refreshActions();
    if (isTargetActivatable(agent)) {
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
