export function isStoppedHermesTarget(target) {
  if (!target) return false;
  if (target.activatable === true || target.availability === "connectable") return true;
  if (target.gateway) return target.gateway !== "running";
  return false;
}

export function isTargetSendable(target) {
  if (!target) return false;
  if (isStoppedHermesTarget(target)) return false;
  return target.available !== false;
}

export function isTargetActivatable(target) {
  if (!target) return false;
  if (target.activatable === true || target.availability === "connectable") return true;
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
