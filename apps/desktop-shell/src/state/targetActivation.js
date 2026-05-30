export function isStoppedHermesTarget(target) {
  if (!target || target.providerId !== "hermes") return false;
  if (target.gateway) return target.gateway !== "running";
  return target.state === 9;
}

export function isTargetSendable(target) {
  if (!target) return false;
  if (isStoppedHermesTarget(target)) return false;
  return target.available !== false;
}

export function isTargetActivatable(target) {
  if (!isStoppedHermesTarget(target)) return false;
  if (target.kind && target.kind !== "profile") return false;
  if (target.profileExecutable || target.profileAlias || target.alias) return true;
  return target.isDefault === true || target.profileName === "default";
}

export function isTargetSelectable(target) {
  return isTargetSendable(target) || isTargetActivatable(target);
}

export function canTargetStartSession(target) {
  return isTargetSendable(target) || isTargetActivatable(target);
}
