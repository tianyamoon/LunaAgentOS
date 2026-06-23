// Runtime 数字状态在多个 View 中共享，这里集中维护“状态 -> 样式”的展示映射。
export const stateClasses = {
  0: "state-init",
  1: "state-idle",
  2: "state-think",
  3: "state-tooling",
  4: "state-resp",
  5: "state-done",
  6: "state-stopped",
  9: "state-error",
};

const stateNames = {
  0: "INIT",
  1: "IDLE",
  2: "THINK",
  3: "TOOLING",
  4: "RESP",
  5: "DONE",
  6: "STOPPED",
  9: "ERROR",
};

const stateDisplayNames = {
  0: "Starting",
  1: "Ready",
  2: "Thinking",
  3: "Using tools",
  4: "Responding",
  5: "Done",
  6: "Stopped",
  9: "Error",
};

const stateDisplayKeys = {
  0: "state.init",
  1: "state.idle",
  2: "state.think",
  3: "state.tooling",
  4: "state.response",
  5: "state.done",
  6: "state.stopped",
  9: "state.error",
};

// Provider availability 是 Fleet/Workspace 的展示摘要，不参与 Adapter 运行分支。
const providerAvailabilityStates = {
  probing: { state: 0, key: "provider.probing" },
  available: { state: 1, key: "provider.available" },
  partial: { state: 2, key: "provider.partial" },
  not_connected: { state: 9, key: "provider.notConnected" },
  not_configured: { state: 9, key: "provider.not_configured" },
  unavailable: { state: 9, key: "provider.unavailable" },
  planned: { state: 6, key: "provider.planned" },
};

const runtimeStateLabels = {
  live: "Live",
  archived: "Read-only",
  restoring: "Reconnecting",
  resume_failed: "Reconnect failed",
};

const runtimeStateKeys = {
  live: "runtime.live",
  archived: "runtime.archived",
  restoring: "runtime.restoring",
  resume_failed: "runtime.resumeFailed",
};

export const runtimeStateClasses = {
  live: "runtime-live",
  archived: "runtime-archived",
  restoring: "runtime-restoring",
  resume_failed: "runtime-failed",
};

export function stateName(state) {
  return stateNames[state] || "UNKNOWN";
}

export function stateDisplayLabel(state, translate = null) {
  const key = stateDisplayKeys[state];
  if (key && translate) return translate(key);
  return stateDisplayNames[state] || "UNKNOWN";
}

export function runtimeStateLabel(runtimeState, translate = null) {
  const key = runtimeStateKeys[runtimeState];
  if (key && translate) return translate(key);
  return runtimeStateLabels[runtimeState] || runtimeState;
}

export function providerAvailabilityState(summary) {
  return providerAvailabilityStates[summary]?.state;
}

export function providerAvailabilityLabel(summary, translate = null) {
  const key = providerAvailabilityStates[summary]?.key;
  return key && translate ? translate(key) : summary;
}
