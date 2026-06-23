import { ACCESS_MODE } from "./sessionStatus.js";

function translateOrKey(translate, key) {
  return typeof translate === "function" ? translate(key) : key;
}

export function currentSessionSendBlockReason(session, agent, {
  canSendToSession = () => false,
  canRestoreSession = () => false,
  translate = null,
} = {}) {
  if (!session) return "";
  if (agent && session.agentId !== agent.id) return translateOrKey(translate, "composer.blockInactiveSession");
  if (canSendToSession(session)) return "";
  if (session?.runtime_binding?.state === "reconnecting") {
    return translateOrKey(translate, "session.restoringSendBlocked");
  }
  if (session.access_mode === ACCESS_MODE.read_only) {
    return canRestoreSession(session)
      ? translateOrKey(translate, "session.readOnlySwitchBlocked")
      : translateOrKey(translate, "session.readOnlyCannotRestore");
  }
  return canRestoreSession(session)
    ? translateOrKey(translate, "session.notSendableRestoreRequired")
    : translateOrKey(translate, "session.notSendableStartNewRequired");
}
