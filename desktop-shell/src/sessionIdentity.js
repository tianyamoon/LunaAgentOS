const LEGACY_PROVIDER_RUNTIME_DEFAULTS = {
  claude: { runtimeInstanceId: "claude-win", runtimeLabel: "Win", runtimeHost: "native" },
  hermes: { runtimeInstanceId: "hermes-wsl", runtimeLabel: "WSL", runtimeHost: "wsl" },
};

export function runtimeHostForInstance(instance) {
  return instance?.commandKind || instance?.host || null;
}

export function hermesProfileNameFromAgentId(agentId) {
  if (!agentId) return "";
  if (agentId.includes(":profile:")) return agentId.split(":profile:").at(-1) || "";
  if (agentId.startsWith("hermes-profile-")) return agentId.replace("hermes-profile-", "");
  return "";
}

export function runtimeDefaultsForProvider(providerId, runtimeInstanceId = null, runtimeInstances = []) {
  if (runtimeInstanceId) {
    const instance = runtimeInstances.find((item) => item.id === runtimeInstanceId);
    if (instance) {
      return {
        runtimeInstanceId: instance.id,
        runtimeLabel: instance.runtimeLabel || null,
        runtimeHost: runtimeHostForInstance(instance),
        runtimeCommand: instance.command || null,
      };
    }
    if (runtimeInstanceId.endsWith("-wsl")) {
      return {
        runtimeInstanceId,
        runtimeLabel: "WSL",
        runtimeHost: "wsl",
        runtimeCommand: null,
      };
    }
    if (runtimeInstanceId.endsWith("-win")) {
      return {
        runtimeInstanceId,
        runtimeLabel: "Win",
        runtimeHost: "native",
        runtimeCommand: null,
      };
    }
  }
  return LEGACY_PROVIDER_RUNTIME_DEFAULTS[providerId] || {
    runtimeInstanceId: runtimeInstanceId || null,
    runtimeLabel: null,
    runtimeHost: null,
    runtimeCommand: null,
  };
}

export function profileMetaFromTarget(target) {
  if (!target || target.providerId !== "hermes") return null;
  return {
    profileName: target.profileName || null,
    profileAlias: target.profileAlias || target.alias || null,
    profileExecutable: target.profileExecutable || target.alias || null,
    profilePath: target.profilePath || target.path || null,
    profileModel: target.model || target.profileModel || null,
    gateway: target.gateway || null,
    skillCount: target.skillCount ?? null,
    hasSoul: Boolean(target.hasSoul),
  };
}

export function profileMetaFromTurns(turns = []) {
  return turns.find((turn) => turn?.meta?.hermesProfile)?.meta?.hermesProfile || null;
}

export function profileKeyFromSession(session = {}) {
  return session.profileAlias
    || session.profileExecutable
    || session.profileName
    || hermesProfileNameFromAgentId(session.targetId)
    || hermesProfileNameFromAgentId(session.agentId)
    || "";
}

export function findHermesProfileTarget(session, runtimeTargets = []) {
  if (!session || session.providerId !== "hermes") return null;
  const runtimeInstanceId = session.runtimeInstanceId || null;
  const profileKey = profileKeyFromSession(session);
  return runtimeTargets.find((target) => {
    if (target.providerId !== "hermes") return false;
    if (runtimeInstanceId && target.runtimeInstanceId !== runtimeInstanceId) return false;
    return target.id === session.targetId
      || target.id === session.agentId
      || target.profileName === profileKey
      || target.profileAlias === profileKey
      || target.alias === profileKey;
  }) || null;
}

export function displayProviderName(providerId, providerName, providers = []) {
  return providers.find((provider) => provider.id === providerId)?.name || providerName || "";
}

function pathBasename(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.split(/[\\/]/).filter(Boolean).at(-1) || text;
}

function hermesProfileDisplayName(session = {}) {
  return session.profileName
    || pathBasename(session.profileAlias)
    || pathBasename(session.profileExecutable)
    || hermesProfileNameFromAgentId(session.targetId)
    || hermesProfileNameFromAgentId(session.agentId)
    || pathBasename(session.agentName?.split("/").at(-1));
}

export function normalizedSessionTitle(session, providers = []) {
  const providerName = displayProviderName(session.providerId, session.providerName, providers);
  if (session.providerId === "hermes") {
    const runtimeName = session.runtimeLabel ? ` · ${session.runtimeLabel}` : "";
    const profileName = hermesProfileDisplayName(session);
    return [`${providerName || "Hermes"}${runtimeName}`, profileName].filter(Boolean).join(" / ");
  }
  if (session.providerId === "claude") {
    const runtimeName = session.runtimeLabel || "";
    return [providerName || "Claude Code", runtimeName].filter(Boolean).join(" · ");
  }
  return session.agentName || providerName || "当前会话";
}

export function normalizeSessionIdentity(session, context = {}) {
  const providers = context.providers || [];
  const runtimeInstances = context.runtimeInstances || [];
  const runtimeTargets = context.runtimeTargets || [];
  const turnsProfile = profileMetaFromTurns(session.turns || []);
  const next = { ...session };

  const runtimeDefaults = runtimeDefaultsForProvider(
    next.providerId,
    next.runtimeInstanceId || null,
    runtimeInstances,
  );
  next.runtimeInstanceId = next.runtimeInstanceId || runtimeDefaults.runtimeInstanceId || null;
  next.runtimeLabel = next.runtimeLabel || runtimeDefaults.runtimeLabel || null;
  next.runtimeHost = next.runtimeHost || runtimeDefaults.runtimeHost || null;
  next.runtimeCommand = next.runtimeCommand || runtimeDefaults.runtimeCommand || null;

  const target = next.providerId === "hermes" ? findHermesProfileTarget(next, runtimeTargets) : null;
  const targetProfile = profileMetaFromTarget(target);
  const profile = targetProfile || turnsProfile || null;

  if (next.providerId === "hermes") {
    next.profileName = next.profileName || profile?.profileName || null;
    next.profileAlias = next.profileAlias || profile?.profileAlias || null;
    next.profileExecutable = next.profileExecutable || profile?.profileExecutable || null;
    next.profilePath = next.profilePath || profile?.profilePath || null;
    next.profileModel = next.profileModel || profile?.profileModel || null;
    next.gateway = next.gateway || profile?.gateway || null;
    next.skillCount = next.skillCount ?? profile?.skillCount ?? null;
    next.hasSoul = next.hasSoul || Boolean(profile?.hasSoul);
    if (target) {
      next.agentId = target.id;
      next.targetId = target.id;
      next.runtimeInstanceId = next.runtimeInstanceId || target.runtimeInstanceId || null;
      next.runtimeLabel = next.runtimeLabel || target.runtimeLabel || null;
      next.runtimeHost = next.runtimeHost || target.runtimeHost || null;
      next.runtimeCommand = next.runtimeCommand || target.runtimeCommand || null;
    }
  }

  next.providerName = displayProviderName(next.providerId, next.providerName, providers) || next.providerName;
  next.agentName = normalizedSessionTitle(next, providers);
  next.targetName = next.agentName;
  return next;
}
