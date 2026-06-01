// Session Execution Controller Module。
// 统一处理 ACP、fallback、流式事件、错误落盘与重连首轮校验，不理解具体 Adapter。

import { TURN_STATUS, RUNTIME_BINDING_STAGE, RUNTIME_BINDING_STATE } from "../state/sessionStatus.js";
import {
  bindResumeValidationTurn,
  clearResumeValidation,
  isResumeValidationTurn,
} from "../state/resumeValidation.js";

// 创建执行控制器。Adapter 差异通过 capabilities 与回调注入。
export function createSessionExecutionController({
  getSession,
  getAgent,
  getAdapterCapabilities,
  fallbackSessions,
  acpRuntimeClient,
  sessionTurnState,
  sessionRuntimeState,
  saveTurnToHistory,
  rollbackFirstTurnPromptFailure,
  refreshRuntimeTargets,
  renderProviders,
  renderWorkspace,
  renderHistory,
  scheduleSessionCardRender,
  updateActionLabels,
  formatBackendError,
  setAppNotice,
  t,
  pumpFollowUpQueue = () => null,
  requestFrame = () => Promise.resolve(),
}) {
  let runningSessions = 0;
  let promptRunSeq = 0;

  // Prompt Run 标识一次真实 runtime 执行，避免迟到事件被写入后续 Turn。
  function createPromptRunId(session, turn) {
    promptRunSeq += 1;
    return `${session.id}:${turn.id}:${Date.now()}:${promptRunSeq}`;
  }

  // 判断 Session 是否已被终止，避免晚到事件污染状态。
  function isTombstoned(sessionId) {
    return sessionRuntimeState.isSessionDeletedTombstone(sessionId)
      || sessionRuntimeState.isSessionStoppedTombstone(sessionId);
  }

  // 读取 manifest 声明的启动提示，避免 Shell 针对某个 Adapter 写分支。
  function prependStartupNoticeIfNeeded(session, turn) {
    const notice = getAdapterCapabilities(session.providerId)?.startupNotice;
    if (!notice?.messageKey || session.acpStartupNoticeShown || session.acpSessionId) return;
    const identity = notice.identityField ? session[notice.identityField] : session.agentName;
    const message = [notice.prefix, identity, t(notice.messageKey)].filter(Boolean).join(" ");
    session.acpStartupNoticeShown = true;
    // 启动提示也进入统一 Runtime Timeline，避免出现只在旧日志中可见的旁路事件。
    sessionTurnState.appendRuntimeLog(session, message);
  }

  // 批量事件只刷新对应卡片；完成态也不销毁稳定的滚动容器。
  function updateTurnFromEvents(sessionId, turnId, promptRunId, events) {
    const turn = sessionTurnState.updateTurnFromEvents(sessionId, turnId, promptRunId, events);
    if (!turn) return null;
    scheduleSessionCardRender(sessionId);
    renderHistory();
    return turn;
  }

  // 路由流式事件，并在出现有效输出后完成首轮健康确认。
  function appendStreamEvent(sessionId, turnId, promptRunId, event) {
    const result = sessionTurnState.appendStreamEvent(sessionId, turnId, promptRunId, event);
    if (!result) return null;
    const { session, turn } = result;
    const validatedByStream = turn.finalResponse
      || event.type === "thought"
      || event.type === "tool"
      || event.type === "plan"
      || turn.status === TURN_STATUS.waiting_confirmation
      || turn.status === TURN_STATUS.completed;
    if (isResumeValidationTurn(session, turn.id) && turn.status !== TURN_STATUS.failed && validatedByStream) {
      clearResumeValidation(session);
    }
    scheduleSessionCardRender(session.id);
    return result;
  }

  // 把 prompt 错误写入 Turn，并局部刷新卡片，避免错误落盘时滚动位置跳动。
  function appendErrorToTurn(sessionId, turnId, message) {
    const session = getSession(sessionId);
    const turn = session?.turns?.find((item) => item.id === turnId);
    if (!session || !turn) return null;
    sessionTurnState.markPromptError(session, turn, message);
    scheduleSessionCardRender(sessionId);
    renderHistory();
    setAppNotice(t("runtime.failed", { agent: session.agentName, message }), "error");
    return turn;
  }

  // 把 fallback 事件中的 i18n key 转为当前语言文本。
  function localizedFallbackEvents(events = []) {
    return events.map((event) => ({
      ...event,
      payload: {
        ...(event.payload || {}),
        content: event.contentKey ? t(event.contentKey) : event.payload?.content,
      },
    }));
  }

  // 记录执行数量变化，集中刷新相关按钮。
  function changeRunningCount(delta) {
    runningSessions = Math.max(0, runningSessions + delta);
    updateActionLabels();
  }

  // 执行 fallback 事件序列，供没有 ACP 能力的入口使用。
  async function runFallbackSession(session, turn) {
    const fallback = fallbackSessions[session.providerId];
    if (!fallback) return null;
    changeRunningCount(1);
    const promptRunId = createPromptRunId(session, turn);
    sessionTurnState.beginPromptRun(session, turn, promptRunId);
    prependStartupNoticeIfNeeded(session, turn);
    renderWorkspace();
    setAppNotice(t("runtime.sentNotice", { agent: session.agentName }), "busy");
    sessionRuntimeState.setRuntimeBinding(session, { state: RUNTIME_BINDING_STATE.connected, stage: RUNTIME_BINDING_STAGE.prompt });
    let shouldPumpQueue = false;
    try {
      if (isTombstoned(session.id)) return null;
      const saved = updateTurnFromEvents(session.id, turn.id, promptRunId, localizedFallbackEvents(fallback.events));
      if (isTombstoned(session.id)) return null;
      if (saved) {
        sessionRuntimeState.clearRuntimeBindingError(session);
        await saveTurnToHistory(session, saved);
        setAppNotice(t("runtime.completedSaved", { agent: session.agentName }));
        shouldPumpQueue = saved.status === TURN_STATUS.completed;
      }
      return saved;
    } catch (error) {
      if (isTombstoned(session.id)) return null;
      appendErrorToTurn(session.id, turn.id, formatBackendError(error));
      await saveTurnToHistory(session, turn);
      return turn;
    } finally {
      sessionTurnState.endPromptRun(session, turn, promptRunId);
      changeRunningCount(-1);
      if (shouldPumpQueue) pumpFollowUpQueue(session);
    }
  }

  // 执行 ACP prompt；重连后的第一轮失败会立即回退为只读。
  async function startAcpSession(session, turn) {
    if (!acpRuntimeClient.canHandle(session.providerId)) return runFallbackSession(session, turn);
    bindResumeValidationTurn(session, turn.id);
    changeRunningCount(1);
    const promptRunId = createPromptRunId(session, turn);
    sessionTurnState.beginPromptRun(session, turn, promptRunId);
    prependStartupNoticeIfNeeded(session, turn);
    renderWorkspace();
    setAppNotice(t("runtime.sentNotice", { agent: session.agentName }), "busy");
    sessionRuntimeState.setRuntimeBinding(session, { state: RUNTIME_BINDING_STATE.connected, stage: RUNTIME_BINDING_STAGE.prompt });
    let shouldPumpQueue = false;
    try {
      await requestFrame();
      const events = await acpRuntimeClient.prompt(session, turn, promptRunId);
      if (isTombstoned(session.id)) return null;
      const saved = updateTurnFromEvents(session.id, turn.id, promptRunId, events);
      if (isTombstoned(session.id)) return null;
      if (!saved) return null;
      const failedBeforeAnyOutput = saved.status === TURN_STATUS.failed && !saved.finalResponse && !saved.outputs?.length;
      if (isResumeValidationTurn(session, turn.id) && failedBeforeAnyOutput) {
        const message = saved.logs.at(0) || saved.finalResponse || t("runtime.promptFailedTitle", { agent: session.agentName });
        rollbackFirstTurnPromptFailure(session, saved, message);
        await saveTurnToHistory(session, saved);
        return saved;
      }
      clearResumeValidation(session);
      sessionRuntimeState.clearRuntimeBindingError(session);
      const agent = getAgent(session.agentId);
      if (agent) agent.state = session.state;
      renderProviders();
      await saveTurnToHistory(session, saved);
      if (getAdapterCapabilities(session.providerId)?.refreshTargetsAfterPrompt) {
        await refreshRuntimeTargets(session.providerId, session.runtimeInstanceId ? [session.runtimeInstanceId] : null);
      }
      setAppNotice(t("runtime.completedSaved", { agent: session.agentName }));
      shouldPumpQueue = saved.status === TURN_STATUS.completed;
      return saved;
    } catch (error) {
      if (isTombstoned(session.id)) return null;
      const message = formatBackendError(error);
      if (isResumeValidationTurn(session, turn.id)) rollbackFirstTurnPromptFailure(session, turn, message);
      else appendErrorToTurn(session.id, turn.id, message);
      await saveTurnToHistory(session, turn);
      return turn;
    } finally {
      sessionTurnState.endPromptRun(session, turn, promptRunId);
      changeRunningCount(-1);
      if (shouldPumpQueue) pumpFollowUpQueue(session);
    }
  }

  return {
    appendErrorToTurn,
    appendStreamEvent,
    runFallbackSession,
    startAcpSession,
    updateTurnFromEvents,
  };
}
