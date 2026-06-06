// Session Restore Controller Module。
// 统一编排归档打开、ACP load/resume、alive 探测与首轮异常回退。

import { LIFECYCLE } from "../state/sessionLifecycle.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
} from "../state/sessionStatus.js";
import {
  clearResumeValidation,
  markResumeValidationPending,
} from "../state/resumeValidation.js";

// 创建恢复控制器。所有 IO 与视图副作用由 Shell 注入，控制器仅维护恢复编排顺序。
export function createSessionRestoreController({
  getArchivedSessions,
  getSessionsSnapshot,
  getCurrentSessionId,
  workspaceSessionFromArchived,
  sessionRuntimeState,
  setSessionRecordState,
  setSessionAccessMode,
  setSessionLifecycle,
  setRuntimeBinding,
  clearRuntimeBindingError,
  markSessionInactive,
  markSessionActive,
  upsertSession,
  unmarkStopped,
  saveCurrentTargetAgent,
  saveCurrentSession,
  activateWorkspaceSession,
  shellSurface,
  acpRuntimeClient,
  appendRuntimeLog,
  markPromptError,
  formatBackendError,
  compactNoticeText,
  setAppNotice,
  t,
  logger = console,
}) {
  let restoreIntentSeq = 0;

  // 从 Repository 快照中查找归档 Session。
  function archivedSessionById(sessionId) {
    return getArchivedSessions().find((item) => item.id === sessionId) || null;
  }

  // 归档状态只表示用户手动分组；恢复/只读打开不能擅自改成 archived。
  function preserveSourceRecordState(restored, archived) {
    setSessionRecordState(restored, archived?.record_state || restored?.record_state || RECORD_STATE.active);
  }

  // 把恢复中的 Session 置于工作区，并同步目标与视图。
  function presentRestoredSession(restored, existing = null) {
    if (!existing) upsertSession(restored);
    unmarkStopped(restored.id);
    saveCurrentTargetAgent(restored.agentId);
    saveCurrentSession(restored.id);
    shellSurface.refresh({
      providers: true,
      workspace: true,
      workspaceOptions: { focusSessionId: restored.id },
      history: true,
      historyOptions: { scrollSessionId: restored.id },
      focusComposer: true,
    });
  }

  // 在用户切换其他 Session 后保留当前 deck 滚动位置，避免异步恢复抢走焦点。
  function createRenderRestoreUpdate(restored) {
    const restoreIntentId = ++restoreIntentSeq;
    return () => {
      const focused = restoreIntentId === restoreIntentSeq && getCurrentSessionId() === restored.id;
      shellSurface.refresh({
        workspace: true,
        workspaceOptions: focused ? {} : { preserveDeckScroll: true },
        history: true,
        historyOptions: focused ? { scrollSessionId: restored.id } : {},
      });
    };
  }

  // 以只读方式打开归档转录；该操作不启动 runtime。
  function openArchivedTranscript(sessionId) {
    if (!sessionId) return null;
    const archived = archivedSessionById(sessionId);
    if (!archived) return null;
    const existing = getSessionsSnapshot().find((item) => item.id === archived.id);
    if (existing && sessionRuntimeState(existing) === LIFECYCLE.restoring) {
      activateWorkspaceSession(existing.id, { focusWorkspace: true });
      setAppNotice(t("archive.restoring"), "busy");
      return existing;
    }
    const restored = workspaceSessionFromArchived(archived, existing);
    preserveSourceRecordState(restored, archived);
    setSessionAccessMode(restored, ACCESS_MODE.read_only);
    if (!existing) upsertSession(restored);
    markSessionInactive(restored.id);
    saveCurrentTargetAgent(restored.agentId);
    saveCurrentSession(restored.id);
    shellSurface.refresh({
      providers: true,
      workspace: true,
      workspaceOptions: { focusSessionId: restored.id },
      history: true,
      historyOptions: { scrollSessionId: restored.id },
    });
    setAppNotice(restored.acpSessionId
      ? t("archive.openedRestorable")
      : t("archive.openedReadOnly"));
    shellSurface.focusComposer();
    return restored;
  }

  // 将完成协议握手的 Session 标记为可交互，并开启首轮异常监测。
  function markRestoreLive(restored, renderRestoreUpdate, noticeKey) {
    setSessionLifecycle(restored, LIFECYCLE.live);
    setSessionAccessMode(restored, ACCESS_MODE.interactive);
    clearRuntimeBindingError(restored);
    markResumeValidationPending(restored);
    markSessionActive(restored.id);
    renderRestoreUpdate();
    setAppNotice(t(noticeKey));
  }

  // load 与 resume 都失败时回退为只读状态，并保留可解释错误。
  function markRestoreFailed(restored, loadError, resumeError, renderRestoreUpdate) {
    const formattedLoadError = formatBackendError(loadError);
    const formattedResumeError = formatBackendError(resumeError || loadError);
    appendRuntimeLog(
      restored,
      [
        t("restore.failedLogHeader"),
        t("restore.loadFailedLine", { error: formattedLoadError }),
        t("restore.resumeFailedLine", { error: formattedResumeError }),
      ].join("\n"),
      9,
    );
    setSessionLifecycle(restored, LIFECYCLE.resume_failed);
    setSessionAccessMode(restored, ACCESS_MODE.read_only);
    clearResumeValidation(restored);
    setRuntimeBinding(restored, {
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.resume,
      error_title: t("restore.failedTitle"),
      error_detail: [
        t("restore.loadFailedLine", { error: formattedLoadError }),
        t("restore.resumeFailedLine", { error: formattedResumeError }),
      ].join("\n"),
      error_suggestion: t("restore.failedSuggestion"),
    });
    markSessionInactive(restored.id);
    renderRestoreUpdate();
    setAppNotice(t("restore.failedNotice", { error: compactNoticeText(formattedResumeError) }), "error");
  }

  // 尝试恢复归档 Session：优先 load，失败后 shutdown 并 resume。
  async function restoreArchivedSession(sessionId) {
    if (!sessionId) return null;
    const archived = archivedSessionById(sessionId);
    if (!archived) return null;
    const existing = getSessionsSnapshot().find((item) => item.id === archived.id);
    if (existing && sessionRuntimeState(existing) === LIFECYCLE.restoring) {
      setAppNotice(t("archive.restoring"), "busy");
      return existing;
    }
    const restored = workspaceSessionFromArchived(archived, existing);
    clearResumeValidation(restored);
    preserveSourceRecordState(restored, archived);
    setSessionAccessMode(restored, ACCESS_MODE.interactive);
    if (restored.acpSessionId) {
      setSessionLifecycle(restored, LIFECYCLE.restoring);
      setRuntimeBinding(restored, { state: RUNTIME_BINDING_STATE.reconnecting, stage: RUNTIME_BINDING_STAGE.load });
    }
    const renderRestoreUpdate = createRenderRestoreUpdate(restored);
    presentRestoredSession(restored, existing);
    if (!restored.acpSessionId) {
      setSessionLifecycle(restored, LIFECYCLE.archived);
      preserveSourceRecordState(restored, archived);
      setSessionAccessMode(restored, ACCESS_MODE.read_only);
      markSessionInactive(restored.id);
      shellSurface.refresh({ workspace: true, history: true });
      setAppNotice(t("restore.readOnlyMissingSession"));
      return restored;
    }
    shellSurface.refresh({ workspace: true, history: true });
    setAppNotice(t("restore.starting"), "busy");
    if (!acpRuntimeClient.canHandle(restored.providerId)) {
      setSessionLifecycle(restored, LIFECYCLE.archived);
      preserveSourceRecordState(restored, archived);
      markSessionInactive(restored.id);
      renderRestoreUpdate();
      setAppNotice(t("restore.unsupportedProvider"));
      return restored;
    }
    try {
      await acpRuntimeClient.load(restored);
      await acpRuntimeClient.verifyAlive(restored.providerId, restored.id);
      markRestoreLive(restored, renderRestoreUpdate, "restore.reconnected");
    } catch (loadError) {
      try {
        await acpRuntimeClient.shutdown(restored);
      } catch (shutdownError) {
        logger.error(shutdownError);
      }
      try {
        await acpRuntimeClient.resume(restored);
        await acpRuntimeClient.verifyAlive(restored.providerId, restored.id);
        markRestoreLive(restored, renderRestoreUpdate, "restore.loadFailedResumed");
      } catch (resumeError) {
        markRestoreFailed(restored, loadError, resumeError, renderRestoreUpdate);
      }
    }
    return restored;
  }

  // 重连后的首轮执行失败时立即回退到只读，保证列表状态与真实可用性一致。
  function rollbackFirstTurnPromptFailure(session, turn, message) {
    markPromptError(session, turn, message);
    clearResumeValidation(session);
    setSessionLifecycle(session, LIFECYCLE.resume_failed);
    setSessionAccessMode(session, ACCESS_MODE.read_only);
    setRuntimeBinding(session, {
      state: RUNTIME_BINDING_STATE.failed,
      stage: RUNTIME_BINDING_STAGE.prompt,
      error_title: t("restore.firstTurnFailedTitle"),
      error_detail: message,
      error_suggestion: t("restore.firstTurnFailedSuggestion"),
    });
    markSessionInactive(session.id);
    shellSurface.refresh({ workspace: true, history: true });
    setAppNotice(t("restore.firstTurnFailedNotice", { error: compactNoticeText(message) }), "error");
  }

  return {
    openArchivedTranscript,
    restoreArchivedSession,
    rollbackFirstTurnPromptFailure,
  };
}
