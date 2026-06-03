const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const THEME_KEY = "lunaagentos.theme";
const PROVIDER_COLLAPSE_KEY = "lunaagentos.providerCollapsedIds";

// 偏好存储只在这个 Module 内接触浏览器环境，调用方不需要知道 localStorage。
function browserStorage() {
  return typeof globalThis !== "undefined" ? globalThis.localStorage : null;
}

// 所有读取都归一成 null，避免调用方区分 undefined 和空字符串。
function getItem(storage, key) {
  return storage?.getItem?.(key) || null;
}

// 空值语义统一为删除偏好，保持旧逻辑里“不持久化当前 session”的行为可复用。
function setOptionalItem(storage, key, value) {
  if (!storage) return;
  if (value) {
    storage.setItem(key, String(value));
    return;
  }
  storage.removeItem(key);
}

// Provider 折叠状态来自 UI 偏好，坏 JSON 只影响当前偏好，不应阻断启动。
function readStringArray(storage, key) {
  try {
    const value = JSON.parse(getItem(storage, key) || "[]");
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  } catch (_) {
    return [];
  }
}

// 写入时去重，避免多次切换折叠状态后把重复 ID 带回 main.js。
function writeStringArray(storage, key, values) {
  if (!storage) return;
  const uniqueValues = [...new Set(Array.isArray(values) ? values.filter(Boolean).map(String) : [])];
  storage.setItem(key, JSON.stringify(uniqueValues));
}

export function createAppPreferences({
  storage = browserStorage(),
  defaultFontScaleId = "default",
  defaultThemeId = "system",
} = {}) {
  // Interface 保持偏好语义，具体 key 与 legacy 兼容都藏在 Implementation 内。
  return {
    getCurrentTargetId() {
      return getItem(storage, CURRENT_TARGET_AGENT_KEY) || getItem(storage, LEGACY_TARGET_AGENT_KEY);
    },
    setCurrentTargetId(agentId) {
      setOptionalItem(storage, CURRENT_TARGET_AGENT_KEY, agentId);
      storage?.removeItem?.(LEGACY_TARGET_AGENT_KEY);
    },
    clearLegacyTargetId() {
      storage?.removeItem?.(LEGACY_TARGET_AGENT_KEY);
    },
    getCurrentSessionId() {
      return getItem(storage, CURRENT_SESSION_KEY);
    },
    setCurrentSessionId(sessionId) {
      setOptionalItem(storage, CURRENT_SESSION_KEY, sessionId);
    },
    clearCurrentSessionId() {
      storage?.removeItem?.(CURRENT_SESSION_KEY);
    },
    getFontScaleId() {
      return getItem(storage, FONT_SCALE_KEY) || defaultFontScaleId;
    },
    setFontScaleId(fontScaleId) {
      setOptionalItem(storage, FONT_SCALE_KEY, fontScaleId || defaultFontScaleId);
    },
    getThemeId() {
      return getItem(storage, THEME_KEY) || defaultThemeId;
    },
    setThemeId(themeId) {
      setOptionalItem(storage, THEME_KEY, themeId || defaultThemeId);
    },
    getCollapsedProviderIds() {
      return readStringArray(storage, PROVIDER_COLLAPSE_KEY);
    },
    setCollapsedProviderIds(providerIds) {
      writeStringArray(storage, PROVIDER_COLLAPSE_KEY, providerIds);
    },
  };
}
