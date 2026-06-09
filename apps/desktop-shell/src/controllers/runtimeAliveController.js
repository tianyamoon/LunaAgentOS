import { LIFECYCLE } from "../state/sessionLifecycle.js";
import {
  ACCESS_MODE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
} from "../state/sessionStatus.js";

export function createRuntimeAliveController({
  getSessionsSnapshot,
  sessionRuntimeState,
  acpRuntimeClient,
  setSessionLifecycle,
  setSessionAccessMode,
  setRuntimeBinding,
  markSessionInactive,
  shellSurface,
  setAppNotice,
  t,
  logger = console,
}) {
  let pendingSync = null;

  async function performSync() {
    const sessions = getSessionsSnapshot();
    const liveSessions = sessions.filter(
      (session) => sessionRuntimeState(session) === "live" && session.acpSessionId,
    );
    if (!liveSessions.length) return false;

    try {
      const providerIds = [...new Set(liveSessions.map((session) => session.providerId))];
      const aliveByProvider = {};
      for (const providerId of providerIds) {
        if (!acpRuntimeClient.canHandle(providerId)) continue;
        aliveByProvider[providerId] = new Set(await acpRuntimeClient.aliveIds(providerId));
      }

      let mutated = false;
      liveSessions.forEach((session) => {
        const aliveIds = aliveByProvider[session.providerId];
        if (!aliveIds || aliveIds.has(session.id)) return;

        // Runtime 退出必须一次性关闭发送能力、运行绑定和活跃成员资格。
        setSessionLifecycle(session, LIFECYCLE.resume_failed);
        setSessionAccessMode(session, ACCESS_MODE.read_only);
        setRuntimeBinding(session, {
          state: RUNTIME_BINDING_STATE.failed,
          stage: RUNTIME_BINDING_STAGE.runtime,
          error_title: t("runtime.aliveExitedTitle", {
            agent: session.agentName || session.providerName,
          }),
          error_detail: t("runtime.aliveExited"),
          error_suggestion: t("runtime.aliveExitedSuggestion"),
        });
        markSessionInactive(session.id);
        mutated = true;
      });

      if (mutated) {
        shellSurface.refresh({
          workspace: true,
          history: true,
          workspaceStatus: true,
        });
        setAppNotice(t("runtime.aliveExited"), "error");
      }
      return mutated;
    } catch (error) {
      logger.error(error);
      return false;
    }
  }

  function sync() {
    if (!pendingSync) {
      pendingSync = performSync().finally(() => {
        pendingSync = null;
      });
    }
    return pendingSync;
  }

  return { sync };
}
