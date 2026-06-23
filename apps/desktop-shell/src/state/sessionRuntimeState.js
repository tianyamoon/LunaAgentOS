import {
  LIFECYCLE,
  InvalidLifecycleTransition,
  canRestoreLifecycle,
  canSendLifecycle,
  isDeletedLifecycle,
  isStoppedLifecycle,
  lifecycleFromLegacy,
  nextLifecycle,
} from "./sessionLifecycle.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
  createRuntimeBinding,
  normalizeSessionStatusShape,
} from "./sessionStatus.js";

export function createSessionRuntimeState({ sessionsStore, logger = console } = {}) {
  if (!sessionsStore) throw new Error("sessionsStore is required");

  function ensureSessionStatusShape(session) {
    return normalizeSessionStatusShape(session);
  }

  function mutateSession(session, mutator) {
    if (!session || typeof mutator !== "function") return null;
    let result = null;
    const applyMutation = (target) => {
      const mutation = mutator(target) || {};
      result = mutation.value ?? null;
      return mutation.changed !== false;
    };
    const stored = session.id ? sessionsStore.getSession(session.id) : null;
    // 恢复流程会先构造临时 Session，再放入 Store；只有同一对象才触发 Store 通知。
    if (stored === session) {
      sessionsStore.updateSession(session.id, applyMutation);
    } else {
      applyMutation(session);
    }
    return result;
  }

  function sessionLifecycle(session) {
    if (!session) return LIFECYCLE.live;
    if (session.lifecycle) return session.lifecycle;
    return lifecycleFromLegacy({
      runtimeState: session.runtimeState,
      isStopped: sessionsStore.isSessionStopped(session.id),
      isDeleted: sessionsStore.isSessionDeleted(session.id),
    });
  }

  function sessionRecordState(session) {
    ensureSessionStatusShape(session);
    return session?.record_state || RECORD_STATE.active;
  }

  function setSessionRecordState(session, state) {
    if (!session) return null;
    return mutateSession(session, (target) => {
      ensureSessionStatusShape(target);
      const changed = target.record_state !== state;
      target.record_state = state;
      return { changed, value: state };
    });
  }

  function setSessionAccessMode(session, mode) {
    if (!session) return null;
    return mutateSession(session, (target) => {
      ensureSessionStatusShape(target);
      const changed = target.access_mode !== mode;
      target.access_mode = mode;
      return { changed, value: mode };
    });
  }

  function setRuntimeBinding(session, patch = {}) {
    if (!session) return null;
    return mutateSession(session, (target) => {
      ensureSessionStatusShape(target);
      const previous = createRuntimeBinding(target.runtime_binding);
      const next = { ...previous, ...patch };
      const changed = Object.keys(next).some((key) => previous[key] !== next[key]);
      target.runtime_binding = next;
      return { changed, value: next };
    });
  }

  function clearRuntimeBindingError(session, patch = {}) {
    return setRuntimeBinding(session, {
      state: RUNTIME_BINDING_STATE.connected,
      stage: null,
      error_title: null,
      error_detail: null,
      error_suggestion: null,
      ...patch,
    });
  }

  function setSessionLifecycle(session, target) {
    if (!session) return null;
    const from = sessionLifecycle(session);
    let next;
    try {
      next = nextLifecycle(from, target);
    } catch (error) {
      if (error instanceof InvalidLifecycleTransition) {
        logger.error(
          `[lifecycle] illegal transition for session ${session.id}: ${from} -> ${target}; ignoring`,
          error,
        );
        return from;
      }
      throw error;
    }
    sessionsStore.batch(() => {
      mutateSession(session, (targetSession) => {
        const changed = targetSession.lifecycle !== next || targetSession.runtimeState !== next;
        targetSession.lifecycle = next;
        targetSession.runtimeState = next;
        return { changed, value: next };
      });
      if (next === LIFECYCLE.archived) {
        setSessionRecordState(session, RECORD_STATE.archived);
      } else if (next === LIFECYCLE.deleted) {
        setSessionRecordState(session, RECORD_STATE.deleted);
      } else if (
        next === LIFECYCLE.live
        || next === LIFECYCLE.restoring
        || next === LIFECYCLE.resume_failed
        || next === LIFECYCLE.stopped
      ) {
        setSessionRecordState(session, RECORD_STATE.active);
      }
      if (next === LIFECYCLE.restoring) {
        setRuntimeBinding(session, {
          state: RUNTIME_BINDING_STATE.reconnecting,
          stage: RUNTIME_BINDING_STAGE.load,
        });
      }
      if (isStoppedLifecycle(next)) {
        if (session.id) sessionsStore.markStopped(session.id);
      } else if (next !== LIFECYCLE.deleted) {
        if (session.id) sessionsStore.unmarkStopped(session.id);
      }
      if (isDeletedLifecycle(next) && session.id) {
        sessionsStore.markDeleted(session.id);
      }
    });
    return next;
  }

  function markSessionDeletedTombstone(sessionId) {
    if (sessionId) sessionsStore.markDeleted(sessionId);
  }

  function isSessionDeletedTombstone(sessionId) {
    return sessionsStore.isSessionDeleted(sessionId);
  }

  function isSessionStoppedTombstone(sessionId) {
    return sessionsStore.isSessionStopped(sessionId);
  }

  function canSendToSession(session) {
    ensureSessionStatusShape(session);
    return session?.record_state === RECORD_STATE.active
      && session?.access_mode === ACCESS_MODE.interactive
      && session?.runtime_binding?.state !== RUNTIME_BINDING_STATE.failed
      && canSendLifecycle(sessionLifecycle(session));
  }

  function canRestoreSession(session) {
    ensureSessionStatusShape(session);
    return Boolean(session?.acpSessionId)
      && (
        session?.record_state === RECORD_STATE.archived
        || session?.runtime_binding?.state === RUNTIME_BINDING_STATE.failed
        || canRestoreLifecycle(sessionLifecycle(session))
      );
  }

  return {
    canRestoreSession,
    canSendToSession,
    clearRuntimeBindingError,
    ensureSessionStatusShape,
    isSessionDeletedTombstone,
    isSessionStoppedTombstone,
    markSessionDeletedTombstone,
    sessionLifecycle,
    sessionRecordState,
    sessionRuntimeState: sessionLifecycle,
    setRuntimeBinding,
    setSessionAccessMode,
    setSessionLifecycle,
    setSessionRecordState,
  };
}
