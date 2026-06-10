import {
  agentBriefTargetKey,
  briefRecordForTarget,
  explicitBriefText,
  fallbackBriefKeyForTarget,
} from "../providers/agentMetadata.js";

function clonePlainData(value) {
  if (Array.isArray(value)) return value.map(clonePlainData);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clonePlainData(item)]),
    );
  }
  return value;
}

export function normalizedAgentBriefs(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? clonePlainData(value) : {};
}

export function normalizedAgentPreferences(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? clonePlainData(value) : {};
}

// Runtime 配置状态是 Shell 和 Tauri 配置文件之间的唯一前端 Seam。
export function createRuntimeConfigState({
  invoke,
  now = () => new Date().toISOString(),
} = {}) {
  let runtimeConfigSnapshot = null;
  let agentBriefs = {};
  let agentPreferences = {};

  async function load() {
    const config = typeof invoke === "function" ? await invoke("load_runtime_config") : {};
    runtimeConfigSnapshot = config || {};
    agentBriefs = normalizedAgentBriefs(runtimeConfigSnapshot.agentBriefs);
    agentPreferences = normalizedAgentPreferences(runtimeConfigSnapshot.agentPreferences);
    return getSnapshot();
  }

  async function ensure() {
    if (runtimeConfigSnapshot) return getSnapshot();
    return load();
  }

  async function saveAgentBriefRecords(nextBriefs) {
    const current = typeof invoke === "function" ? await invoke("load_runtime_config") : runtimeConfigSnapshot;
    const config = {
      ...(current || {}),
      agentBriefs: normalizedAgentBriefs(nextBriefs),
    };
    const saved = typeof invoke === "function"
      ? await invoke("save_runtime_config", { config })
      : config;
    runtimeConfigSnapshot = saved || config;
    agentBriefs = normalizedAgentBriefs(runtimeConfigSnapshot.agentBriefs);
    agentPreferences = normalizedAgentPreferences(runtimeConfigSnapshot.agentPreferences);
    return getAgentBriefsSnapshot();
  }

  async function saveDefaultModel(target, defaultModel) {
    const current = typeof invoke === "function" ? await invoke("load_runtime_config") : runtimeConfigSnapshot;
    const nextPreferences = normalizedAgentPreferences(current?.agentPreferences);
    const key = agentBriefTargetKey(target);
    if (!key) return getAgentPreferencesSnapshot();
    const model = String(defaultModel || "").trim();
    if (model) nextPreferences[key] = { ...(nextPreferences[key] || {}), defaultModel: model };
    else delete nextPreferences[key];
    const config = { ...(current || {}), agentPreferences: nextPreferences };
    const saved = typeof invoke === "function" ? await invoke("save_runtime_config", { config }) : config;
    runtimeConfigSnapshot = saved || config;
    agentBriefs = normalizedAgentBriefs(runtimeConfigSnapshot.agentBriefs);
    agentPreferences = normalizedAgentPreferences(runtimeConfigSnapshot.agentPreferences);
    return getAgentPreferencesSnapshot();
  }

  function getSnapshot() {
    return clonePlainData(runtimeConfigSnapshot || {});
  }

  function getAgentBriefsSnapshot() {
    return normalizedAgentBriefs(agentBriefs);
  }

  function getAgentPreferencesSnapshot() {
    return normalizedAgentPreferences(agentPreferences);
  }

  function defaultModelForTarget(target) {
    const key = agentBriefTargetKey(target);
    return key ? agentPreferences[key]?.defaultModel || "" : "";
  }

  function targetBriefRecord(target, language) {
    return briefRecordForTarget(agentBriefs, target, language);
  }

  function targetBriefText(target, { language, translate } = {}) {
    const record = targetBriefRecord(target, language);
    if (record?.text) return record.text;
    const explicit = explicitBriefText(target);
    if (explicit) return explicit;
    const key = fallbackBriefKeyForTarget(target);
    return typeof translate === "function" ? translate(key) : key;
  }

  function targetBriefInputValue(target, language) {
    return targetBriefRecord(target, language)?.text || "";
  }

  function writeBriefValue(nextBriefs, target, language, value, source = "manual") {
    const key = agentBriefTargetKey(target);
    if (!key) return;
    if (!nextBriefs[key] || typeof nextBriefs[key] !== "object") nextBriefs[key] = {};
    const text = String(value || "").trim();
    if (!text) {
      delete nextBriefs[key][language];
      if (!Object.keys(nextBriefs[key]).length) delete nextBriefs[key];
      return;
    }
    nextBriefs[key][language] = {
      text,
      source,
      updatedAt: now(),
    };
  }

  return {
    load,
    ensure,
    saveAgentBriefRecords,
    saveDefaultModel,
    getSnapshot,
    getAgentBriefsSnapshot,
    getAgentPreferencesSnapshot,
    defaultModelForTarget,
    targetBriefRecord,
    targetBriefText,
    targetBriefInputValue,
    writeBriefValue,
  };
}
