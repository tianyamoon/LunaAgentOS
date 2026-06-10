export const HEALTH_STATE = Object.freeze({
  ok: "ok",
  missing: "missing",
  failed: "failed",
  required: "required",
  unknown: "unknown",
  outdated: "outdated",
});

export const HEALTH_FIELDS = Object.freeze([
  "installed",
  "logged_in",
  "cli_callable",
  "profile_configured",
  "wsl_or_bridge_available",
  "model_or_key_configured",
  "version_status",
]);

const KNOWN_STATES = new Set(Object.values(HEALTH_STATE));

function state(value, fallback = HEALTH_STATE.unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return KNOWN_STATES.has(normalized) ? normalized : fallback;
}

function explicitHealth(source = {}) {
  const input = source.health && typeof source.health === "object" ? source.health : {};
  const camelFields = {
    logged_in: "loggedIn",
    cli_callable: "cliCallable",
    profile_configured: "profileConfigured",
    wsl_or_bridge_available: "wslOrBridgeAvailable",
    model_or_key_configured: "modelOrKeyConfigured",
    version_status: "versionStatus",
  };
  const health = {};
  for (const field of HEALTH_FIELDS) {
    health[field] = state(input[field] ?? input[camelFields[field]]);
  }
  health.unavailable_reason = input.unavailable_reason || input.unavailableReason || null;
  health.repair_hint = input.repair_hint || input.repairHint || null;
  health.unavailable_reason_params = input.unavailable_reason_params || input.unavailableReasonParams || {};
  health.repair_hint_params = input.repair_hint_params || input.repairHintParams || {};
  health.evidence = source.healthEvidence || source.health_evidence || input.evidence || [];
  return health;
}

function healthWithDefaults(source, defaults) {
  const explicit = explicitHealth(source);
  const hasExplicitHealth = Boolean(source?.health && typeof source.health === "object");
  const health = {
    ...explicit,
    ...Object.fromEntries(
      HEALTH_FIELDS.map((field) => [
        field,
        hasExplicitHealth ? explicit[field] : explicit[field] !== HEALTH_STATE.unknown ? explicit[field] : defaults[field],
      ]),
    ),
    unavailable_reason: explicit.unavailable_reason || defaults.unavailable_reason || null,
    repair_hint: explicit.repair_hint || defaults.repair_hint || null,
    unavailable_reason_params: {
      ...(defaults.unavailable_reason_params || {}),
      ...(explicit.unavailable_reason_params || {}),
    },
    repair_hint_params: {
      ...(defaults.repair_hint_params || {}),
      ...(explicit.repair_hint_params || {}),
    },
    evidence: explicit.evidence,
  };
  health.overall = deriveOverallHealth(health);
  health.diagnostics = HEALTH_FIELDS.map((field) => ({ field, state: health[field] }));
  return health;
}

function derivedVersionStatus(item) {
  if (item?.versionStatus) return state(item.versionStatus);
  if (item?.version_status) return state(item.version_status);
  return item?.version ? HEALTH_STATE.ok : HEALTH_STATE.unknown;
}

function reasonParams(item) {
  return { detail: item?.detail || item?.summary || "" };
}

export function deriveRuntimeHealth(instance = {}) {
  const available = instance.available === true;
  const configured = instance.configured !== false;
  const bridgeLike = ["wsl", "bridge", "remote", "ide"].includes(String(instance.commandKind || "").toLowerCase());
  const defaults = {
    installed: available ? HEALTH_STATE.ok : configured ? HEALTH_STATE.unknown : HEALTH_STATE.missing,
    logged_in: HEALTH_STATE.unknown,
    cli_callable: available ? HEALTH_STATE.ok : HEALTH_STATE.failed,
    profile_configured: HEALTH_STATE.unknown,
    wsl_or_bridge_available: bridgeLike
      ? available ? HEALTH_STATE.ok : HEALTH_STATE.failed
      : HEALTH_STATE.unknown,
    model_or_key_configured: HEALTH_STATE.unknown,
    version_status: derivedVersionStatus(instance),
    unavailable_reason: available ? null : "cli_not_callable",
    repair_hint: available ? null : "check_runtime_command",
    unavailable_reason_params: reasonParams(instance),
    repair_hint_params: reasonParams(instance),
  };
  return healthWithDefaults(instance, defaults);
}

export function deriveProviderHealth(provider = {}, availability = {}, instances = []) {
  const available = availability.available === true || instances.some((instance) => instance.available);
  const configured = availability.configured !== false;
  const hasRuntime = instances.length > 0;
  const anyFailedRuntime = hasRuntime && instances.some((instance) => instance.available === false);
  const defaults = {
    installed: available || hasRuntime ? HEALTH_STATE.ok : configured ? HEALTH_STATE.unknown : HEALTH_STATE.missing,
    logged_in: HEALTH_STATE.unknown,
    cli_callable: available ? HEALTH_STATE.ok : anyFailedRuntime ? HEALTH_STATE.failed : HEALTH_STATE.unknown,
    profile_configured: HEALTH_STATE.unknown,
    wsl_or_bridge_available: anyFailedRuntime ? HEALTH_STATE.failed : HEALTH_STATE.unknown,
    model_or_key_configured: HEALTH_STATE.unknown,
    version_status: HEALTH_STATE.unknown,
    unavailable_reason: available ? null : configured ? "no_available_runtime" : "provider_not_configured",
    repair_hint: available ? null : configured ? "check_runtime_command" : "configure_provider",
    unavailable_reason_params: reasonParams(availability),
    repair_hint_params: reasonParams(availability),
  };
  return healthWithDefaults(provider, defaults);
}

export function deriveTargetHealth(target = {}, { sendable = false, activatable = false } = {}) {
  const profileLike = target.kind === "profile" || Boolean(target.profileName || target.profilePath);
  const hasProfileIdentity = Boolean(target.profileName || target.profilePath || target.profileAlias || target.profileExecutable);
  const unavailableReason = sendable
    ? null
    : activatable
      ? "runtime_stopped"
      : profileLike && !hasProfileIdentity
        ? "profile_not_configured"
        : "target_unavailable";
  const repairHint = sendable
    ? null
    : activatable
      ? "send_to_connect"
      : profileLike && !hasProfileIdentity
        ? "configure_profile"
        : "check_agent_configuration";
  const defaults = {
    installed: HEALTH_STATE.ok,
    logged_in: HEALTH_STATE.unknown,
    cli_callable: sendable || activatable ? HEALTH_STATE.ok : HEALTH_STATE.unknown,
    profile_configured: profileLike
      ? hasProfileIdentity ? HEALTH_STATE.ok : HEALTH_STATE.missing
      : HEALTH_STATE.unknown,
    wsl_or_bridge_available: HEALTH_STATE.unknown,
    model_or_key_configured: HEALTH_STATE.unknown,
    version_status: derivedVersionStatus(target),
    unavailable_reason: unavailableReason,
    repair_hint: repairHint,
    unavailable_reason_params: reasonParams(target),
    repair_hint_params: reasonParams(target),
  };
  return healthWithDefaults(target, defaults);
}

export function deriveOverallHealth(health = {}) {
  if (health.unavailable_reason === "runtime_stopped") return "connectable";
  if (health.unavailable_reason) return "unavailable";
  if (HEALTH_FIELDS.some((field) => [HEALTH_STATE.missing, HEALTH_STATE.failed, HEALTH_STATE.required].includes(health[field]))) {
    return "unavailable";
  }
  if (health.version_status === HEALTH_STATE.outdated) return "attention";
  if (HEALTH_FIELDS.some((field) => health[field] === HEALTH_STATE.unknown)) return "unknown";
  return "available";
}
