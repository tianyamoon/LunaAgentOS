// Session Lifecycle Controller Module。
// 统一编排 stop、archive、dismiss 与 delete，隔离 Runtime、History 和 Workspace 的联动细节。

import { LIFECYCLE, isArchivedLifecycle } from "../state/sessionLifecycle.js";

// 创建生命周期控制器。副作用由 Shell 注入，便于独立测试状态流。
export function createSessionLifecycleController({
  getSession,
  getArchivedSession,
  getCurrentSessionId,
  sessionRuntimeState,
  isSessionExecuting,
  setSessionLifecycle,
  markSessionDeletedTombstone,
  markSessionStopped,
  acpRuntimeClient,
  historyRepository,
  saveTurnToHistory,
  removeSessionById,
  setWorkspaceVisibility,
  markSessionInactive,
  clearCurrentSessionIf,
  clearScheduledWorkspaceFocus,
  clearQueuedSubmissions = () => 0,
  shellSurface,
  openConfirmDialog,
  formatBackendError,
  setAppNotice,
  t,
  logger = console,
}) {
  // 关闭 Runtime。失败仅记录日志，不阻断本地生命周期收敛。
  async function shutdownQuietly(session) {
    try {
      await acpRuntimeClient.shutdown(session);
    } catch (error) {
      logger.error(error);
    }
  }

  // 从工作区彻底移除 Session，并清理焦点与活跃标记。
  function removeSessionFromWorkspace(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    clearScheduledWorkspaceFocus(sessionId);
    removeSessionById(sessionId);
    markSessionInactive(session.id);
    clearCurrentSessionIf(session.id);
    return session;
  }

  // 归档 Session：先停止运行，再同步 History，最后移出工作区。
  async function archiveLiveSession(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    const shouldMarkStopped = isSessionExecuting(session);
    clearQueuedSubmissions(session, "archive");
    if (shouldMarkStopped) setSessionLifecycle(session, LIFECYCLE.stopped);
    await shutdownQuietly(session);
    const stoppedTurn = shouldMarkStopped ? markSessionStopped(session) : null;
    setSessionLifecycle(session, LIFECYCLE.archived);
    try {
      await historyRepository.archiveSession(sessionId);
      if (stoppedTurn) await saveTurnToHistory(session, stoppedTurn);
    } catch (error) {
      logger.error(error);
    }
    removeSessionFromWorkspace(session.id);
    shellSurface.refresh({ workspace: true, history: true });
    setAppNotice(t("session.archivedNotice", { agent: session.agentName }));
    return session;
  }

  // 停止 Session 的 Runtime，但保留工作区 Session 供用户继续查看。
  async function stopSession(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    const runtimeState = sessionRuntimeState(session);
    if (runtimeState === LIFECYCLE.restoring) {
      setAppNotice(t("session.stopRestoringBlocked"), "busy");
      return session;
    }
    if (runtimeState !== LIFECYCLE.live) {
      setAppNotice(t("session.stopNoLiveRuntime"), "busy");
      return session;
    }
    setSessionLifecycle(session, LIFECYCLE.stopped);
    clearQueuedSubmissions(session, "stop");
    await shutdownQuietly(session);
    setSessionLifecycle(session, LIFECYCLE.live);
    const stoppedTurn = markSessionStopped(session);
    try {
      if (stoppedTurn) await saveTurnToHistory(session, stoppedTurn);
    } catch (error) {
      logger.error(error);
    }
    shellSurface.refresh({ providers: true, workspace: true, history: true });
    setAppNotice(t("session.stoppedNotice", { agent: session.agentName }));
    return session;
  }

  // 仅从工作区隐藏 Session，不中断仍在运行的 Runtime。
  async function dismissWorkspaceSession(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    const wasArchived = isArchivedLifecycle(sessionRuntimeState(session));
    setWorkspaceVisibility(session.id, false);
    if (getCurrentSessionId() === sessionId) clearCurrentSessionIf(sessionId);
    clearScheduledWorkspaceFocus(sessionId);
    shellSurface.refresh({ workspace: true, history: true });
    setAppNotice(wasArchived
      ? t("session.dismissedArchived", { agent: session.agentName })
      : t("session.dismissedActive", { agent: session.agentName }));
    return session;
  }

  // 删除 Session 及其 History；恢复中的 Session 会拒绝删除。
  async function deleteSession(sessionId) {
    const session = getSession(sessionId);
    const archived = getArchivedSession(sessionId);
    const runtimeState = session ? sessionRuntimeState(session) : archived?.runtimeState || LIFECYCLE.archived;
    if (runtimeState === LIFECYCLE.restoring) {
      setAppNotice(t("session.deleteRestoringBlocked"), "busy");
      return null;
    }
    if (!session && !archived) return null;
    try {
      if (session) setSessionLifecycle(session, LIFECYCLE.deleted);
      else markSessionDeletedTombstone(sessionId);
      if (session) clearQueuedSubmissions(session, "delete");
      if (session && runtimeState === LIFECYCLE.live) await shutdownQuietly(session);
      removeSessionFromWorkspace(sessionId);
      const result = await historyRepository.deleteSession(sessionId);
      shellSurface.refresh({ workspace: true, history: true });
      const skipped = result?.skippedFiles ? t("session.deleteSkippedFiles", { count: result.skippedFiles }) : "";
      setAppNotice(t("session.deleted", { count: result?.removedCount || 0, skipped }));
      return result;
    } catch (error) {
      logger.error(error);
      setAppNotice(t("session.deleteFailed", { error: formatBackendError(error) }), "error");
      return null;
    }
  }

  // 打开删除确认弹窗，真正删除仍通过统一 command 执行。
  function requestDeleteConfirmation(sessionId) {
    const session = getSession(sessionId);
    const archived = getArchivedSession(sessionId);
    const title = session?.title || archived?.title || t("confirm.sessionFallback");
    openConfirmDialog({
      title: t("confirm.deleteSessionTitle"),
      message: t("confirm.deleteSessionMessage", { title }),
      confirmLabel: t("common.delete"),
      onConfirm: () => deleteSession(sessionId),
    });
  }

  return {
    archiveLiveSession,
    deleteSession,
    dismissWorkspaceSession,
    removeSessionFromWorkspace,
    requestDeleteConfirmation,
    stopSession,
  };
}
