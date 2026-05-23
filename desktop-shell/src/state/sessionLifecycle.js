// session lifecycle state machine
//
// LunaAgentOS keeps too many parallel "is this session alive?" hints:
//   session.runtimeState (string)
//   activeSessionIds (Set<string>)
//   stoppedSessionIds (Set<string>)
//   deletedSessionIds (Set<string>)
//
// They drift apart over time. This module collapses the lifecycle into a
// single string field with a documented transition matrix, plus pure helpers
// the renderers / runtime layer can consume without touching the underlying
// shape directly.
//
// Phase B1: define the machine. Wiring main.js to use it lands in B2 so we
// never have a broken intermediate.

export const LIFECYCLE = Object.freeze({
  draft: "draft",
  live: "live",
  restoring: "restoring",
  archived: "archived",
  resume_failed: "resume_failed",
  stopped: "stopped",
  deleted: "deleted",
});

export const LIFECYCLE_VALUES = Object.freeze(Object.values(LIFECYCLE));

// Transition map: from -> set of allowed next states.
const TRANSITIONS = Object.freeze({
  draft: new Set(["live", "archived", "deleted"]),
  live: new Set(["archived", "restoring", "resume_failed", "stopped", "deleted"]),
  restoring: new Set(["live", "resume_failed", "archived", "deleted"]),
  archived: new Set(["restoring", "deleted"]),
  resume_failed: new Set(["restoring", "archived", "deleted"]),
  stopped: new Set(["archived", "deleted"]),
  deleted: new Set(),
});

export class InvalidLifecycleTransition extends Error {
  constructor(from, to) {
    super(`invalid session lifecycle transition: ${from} -> ${to}`);
    this.name = "InvalidLifecycleTransition";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from, to) {
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, from)) return false;
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, to)) return false;
  if (from === to) return true;
  return TRANSITIONS[from].has(to);
}

export function nextLifecycle(from, to) {
  if (canTransition(from, to)) return to;
  throw new InvalidLifecycleTransition(from, to);
}

export function isLiveLifecycle(state) {
  return state === LIFECYCLE.live;
}

export function isArchivedLifecycle(state) {
  return state === LIFECYCLE.archived || state === LIFECYCLE.resume_failed;
}

export function isTerminalLifecycle(state) {
  return state === LIFECYCLE.deleted;
}

export function canSendLifecycle(state) {
  return state === LIFECYCLE.live;
}

export function canRestoreLifecycle(state) {
  return state === LIFECYCLE.archived || state === LIFECYCLE.resume_failed;
}

export function isRestoringLifecycle(state) {
  return state === LIFECYCLE.restoring;
}

export function isStoppedLifecycle(state) {
  return state === LIFECYCLE.stopped;
}

export function isDeletedLifecycle(state) {
  return state === LIFECYCLE.deleted;
}

// Map historical session.runtimeState plus loose Sets into the new model.
// Returns the lifecycle string. Defaults to "live" if nothing is known.
export function lifecycleFromLegacy({
  runtimeState,
  isStopped = false,
  isDeleted = false,
} = {}) {
  if (isDeleted) return LIFECYCLE.deleted;
  if (isStopped) return LIFECYCLE.stopped;
  if (runtimeState && Object.prototype.hasOwnProperty.call(TRANSITIONS, runtimeState)) {
    return runtimeState;
  }
  return LIFECYCLE.live;
}
