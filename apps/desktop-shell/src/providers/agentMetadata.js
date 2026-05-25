const providerStatusLabelKeys = {
  probing: "provider.probing",
  available: "provider.available",
  partial: "provider.partial",
  not_connected: "provider.notConnected",
  not_configured: "provider.not_configured",
  unavailable: "provider.unavailable",
  planned: "provider.planned",
};

const targetStatusLabelKeys = {
  available: "availability.sendable",
  unavailable: "availability.unavailable",
  gateway_running: "availability.gatewayRunning",
  gateway_stopped: "availability.gatewayStopped",
};

function normalizeStatusState(value, fallback = "unavailable") {
  const state = String(value || "").trim().toLowerCase().replace(/-/g, "_");
  if (["ready", "running", "online", "ok"].includes(state)) return "available";
  if (["stopped", "offline", "error", "failed", "disabled"].includes(state)) return "unavailable";
  return state || fallback;
}

function classNameForState(prefix, state) {
  return `${prefix}${String(state || "unavailable").replace(/_/g, "-")}`;
}

export function providerStatusForFleet(provider, availability = {}) {
  const explicit = availability.status && typeof availability.status === "object" ? availability.status : null;
  const state = normalizeStatusState(explicit?.state || availability.summary || (availability.available ? "available" : "unavailable"));
  return {
    shape: "square",
    state,
    className: classNameForState("is-", state),
    labelKey: explicit?.labelKey || providerStatusLabelKeys[state] || providerStatusLabelKeys.unavailable,
    mutedCard: state === "planned" || state === "not_configured" || (!availability.available && provider?.id === "trae"),
  };
}

export function targetStatusForFleet(target) {
  const explicit = target?.status && typeof target.status === "object" ? target.status : null;
  if (explicit?.state) {
    const state = normalizeStatusState(explicit.state);
    return {
      shape: "circle",
      state,
      className: classNameForState("is-", state),
      labelKey: explicit.labelKey || targetStatusLabelKeys[state] || targetStatusLabelKeys.unavailable,
    };
  }
  const hasGateway = Boolean(target?.gateway);
  const available = target?.available !== false && target?.state !== 9 && (!hasGateway || target.gateway === "running");
  const state = available ? "available" : "unavailable";
  const labelKey = hasGateway
    ? target.gateway === "running"
      ? targetStatusLabelKeys.gateway_running
      : targetStatusLabelKeys.gateway_stopped
    : targetStatusLabelKeys[state];
  return {
    shape: "circle",
    state,
    className: classNameForState("is-", state),
    labelKey,
  };
}

export function isTargetUnavailableForFleet(target) {
  return targetStatusForFleet(target).state !== "available";
}

function cleanKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function agentBriefTargetKey(target) {
  if (!target) return "";
  const provider = cleanKeyPart(target.providerId || target.providerName || "agent");
  const host = cleanKeyPart(target.runtimeHost || target.runtimeLabel || target.runtimeInstanceId || "default");
  const identity = cleanKeyPart(
    target.profileName
      || target.profileAlias
      || target.alias
      || target.profileExecutable
      || target.targetName
      || target.name
      || target.displayName
      || target.id,
  );
  if (provider && host && identity) return `${provider}:${host}:${identity}`;
  return cleanKeyPart(target.id || identity || provider);
}

export function fallbackBriefKeyForTarget(target) {
  if (target?.providerId === "claude") return "agentBrief.fallback.codingRuntime";
  if (target?.providerId === "hermes" && target?.kind === "profile") return "agentBrief.fallback.hermesProfile";
  if (target?.kind === "profile") return "agentBrief.fallback.agentProfile";
  if (target?.dynamicAdapter || target?.runtimeCommand === null) return "agentBrief.fallback.manifestRuntime";
  return "agentBrief.fallback.agentProfile";
}

export function explicitBriefText(target) {
  return target?.brief
    || target?.description
    || target?.summary
    || target?.role
    || target?.purpose
    || "";
}

export function briefRecordForTarget(agentBriefs, target, language) {
  const key = agentBriefTargetKey(target);
  const record = key && agentBriefs && typeof agentBriefs === "object" ? agentBriefs[key] : null;
  const localized = record && typeof record === "object" ? record[language] : null;
  if (localized?.text) return localized;
  return null;
}
