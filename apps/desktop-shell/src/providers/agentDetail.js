const CAPABILITY_KEYS = [
  "files",
  "commands",
  "network",
  "images",
  "browser",
  "localRepo",
];

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && item !== "");
  return [value];
}

function mergeUnique(...values) {
  const seen = new Set();
  const merged = [];
  values.flatMap(asArray).forEach((value) => {
    const key = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(value);
  });
  return merged;
}

function detailSource(provider = {}, target = {}) {
  const manifest = provider.adapterManifest || {};
  return {
    ...(manifest.agentDetail || {}),
    ...(provider.agentDetail || {}),
    ...(target.agentDetail || {}),
  };
}

function normalizeCapability(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      state: value.state || (value.enabled === true ? "enabled" : value.enabled === false ? "unavailable" : "unknown"),
      note: value.note || "",
      noteKey: value.noteKey || "",
    };
  }
  if (value === true) return { state: "enabled", note: "", noteKey: "" };
  if (value === false) return { state: "unavailable", note: "", noteKey: "" };
  if (typeof value === "string" && value) return { state: value, note: "", noteKey: "" };
  return { state: "unknown", note: "", noteKey: "" };
}

function inferRuntimeEnvironment(target = {}, runtimeInstance = {}, source = {}) {
  return firstValue(
    target.runtimeEnvironment,
    target.runtimeEnvironmentKey,
    source.runtimeEnvironment,
    source.runtimeEnvironmentKey,
    runtimeInstance.runtimeEnvironment,
    target.runtimeHost,
    runtimeInstance.runtimeHost,
    runtimeInstance.runtimeLabel,
    target.runtimeLabel,
    runtimeInstance.transport,
    "unknown",
  );
}

function modelInfo(target = {}, provider = {}, runtimeInstance = {}, source = {}, savedDefaultModel = "") {
  const manifest = provider.adapterManifest || {};
  const modelSource = source.models || manifest.models || provider.models || runtimeInstance.models || target.models || {};
  const control = target.modelControl || runtimeInstance.modelControl || provider.modelControl || manifest.modelControl || { mode: "native_runtime" };
  const available = mergeUnique(
    control.availableModels,
    control.available_models,
    modelSource.available,
    modelSource.availableModels,
    target.availableModels,
    runtimeInstance.availableModels,
    target.model,
    target.defaultModel,
  );
  return {
    available,
    defaultModel: firstValue(control.mode === "luna_managed" ? savedDefaultModel : "", target.defaultModel, target.model, runtimeInstance.defaultModel, control.defaultModel, modelSource.default, modelSource.defaultModel),
    recommended: mergeUnique(modelSource.recommended, modelSource.recommendedModels, target.recommendedModels),
    control: {
      mode: control.mode || "native_runtime",
      availableModels: mergeUnique(control.availableModels, control.available_models),
    },
  };
}

function capabilityInfo(target = {}, provider = {}, runtimeInstance = {}, source = {}) {
  const manifestCapabilities = provider.adapterManifest?.capabilities || {};
  const raw = {
    ...(source.capabilities || {}),
    ...(provider.capabilities || {}),
    ...(manifestCapabilities.agent || {}),
    ...(runtimeInstance.capabilities || {}),
    ...(target.capabilities || {}),
  };
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, normalizeCapability(raw[key])]));
}

export function buildAgentDetail({
  target = {},
  provider = {},
  runtimeInstance = null,
  availabilityTarget = null,
  agentBrief = "",
  savedDefaultModel = "",
} = {}) {
  const source = detailSource(provider, target);
  const models = modelInfo(target, provider, runtimeInstance || {}, source, savedDefaultModel);
  const capabilities = capabilityInfo(target, provider, runtimeInstance || {}, source);
  const health = availabilityTarget?.health || target.health || null;
  const runtimeEnvironment = inferRuntimeEnvironment(target, runtimeInstance || {}, source);

  return {
    id: target.id || "",
    name: firstValue(target.name, target.displayName, source.name, provider.name, ""),
    providerId: target.providerId || provider.id || "",
    providerName: firstValue(target.providerName, provider.name, target.providerId, ""),
    profile: firstValue(target.profileName, target.profileAlias, target.alias, target.profileExecutable, source.profile, ""),
    accountIdentity: firstValue(target.accountIdentity, target.account, target.user, target.email, source.accountIdentity, ""),
    runtimeEnvironment,
    runtimeLabel: firstValue(target.runtimeLabel, runtimeInstance?.runtimeLabel, ""),
    runtimeCommand: firstValue(target.runtimeCommand, runtimeInstance?.command, source.runtimeCommand, ""),
    defaultWorkingDirectory: firstValue(target.defaultWorkingDirectory, target.cwd, runtimeInstance?.cwd, source.defaultWorkingDirectory, source.defaultWorkingDirectoryKey, ""),
    brief: firstValue(agentBrief, target.brief, target.description, source.summary, source.summaryKey, source.description, source.descriptionKey, ""),
    models,
    capabilities,
    safety: mergeUnique(target.safetyBoundaries, target.safety, source.safetyBoundaries, source.safety),
    bestPractices: mergeUnique(target.bestPractices, source.bestPractices),
    health,
  };
}

export { CAPABILITY_KEYS };
