export function sessionRuntimeState(session) {
  return session?.runtimeState || "live";
}

export function canSendToSession(session) {
  return sessionRuntimeState(session) === "live";
}

export function sessionMatchesTarget(session, targetId) {
  return Boolean(session && targetId && session.agentId === targetId);
}

export function currentSessionForTarget(currentSession, targetId) {
  return sessionMatchesTarget(currentSession, targetId) ? currentSession : null;
}

export function shouldClearCurrentSessionForTarget(currentSession, targetId) {
  return Boolean(currentSession && !sessionMatchesTarget(currentSession, targetId));
}

export function shouldBlockSendForCurrentSession({ currentSession, targetId, forceNewSession = false }) {
  if (forceNewSession) return false;
  return sessionMatchesTarget(currentSession, targetId) && !canSendToSession(currentSession);
}
