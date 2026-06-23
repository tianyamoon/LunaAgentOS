import test from "node:test";
import assert from "node:assert/strict";
import { createAppPreferences } from "./appPreferences.js";

// 用内存版 Storage 锁定偏好 Module 的读写语义，避免测试依赖浏览器环境。
function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    snapshot: () => Object.fromEntries(data.entries()),
  };
}

test("appPreferences: reads current target from new key before legacy key", () => {
  const storage = createMemoryStorage({
    "lunaagentos.currentTargetId": "new-target",
    "lunaagentos.currentTargetAgentId": "legacy-target",
  });
  const preferences = createAppPreferences({ storage });
  assert.equal(preferences.getCurrentTargetId(), "new-target");

  preferences.setCurrentTargetId("next-target");
  assert.deepEqual(storage.snapshot(), {
    "lunaagentos.currentTargetId": "next-target",
  });
});

test("appPreferences: clears optional session and target values", () => {
  const storage = createMemoryStorage({
    "lunaagentos.currentTargetId": "target",
    "lunaagentos.currentSessionId": "session",
  });
  const preferences = createAppPreferences({ storage });
  preferences.setCurrentTargetId(null);
  preferences.clearCurrentSessionId();
  assert.deepEqual(storage.snapshot(), {});
});

test("appPreferences: falls back to default font scale and theme", () => {
  const preferences = createAppPreferences({
    storage: createMemoryStorage(),
    defaultFontScaleId: "comfortable",
    defaultThemeId: "midnight",
  });
  assert.equal(preferences.getFontScaleId(), "comfortable");
  assert.equal(preferences.getThemeId(), "midnight");

  preferences.setFontScaleId("compact");
  preferences.setThemeId("light");
  assert.equal(preferences.getFontScaleId(), "compact");
  assert.equal(preferences.getThemeId(), "light");
});

test("appPreferences: provider collapse ids tolerate broken json and dedupe writes", () => {
  const storage = createMemoryStorage({
    "lunaagentos.providerCollapsedIds": "{broken",
  });
  const preferences = createAppPreferences({ storage });
  assert.deepEqual(preferences.getCollapsedProviderIds(), []);

  preferences.setCollapsedProviderIds(["hermes", "", "claude", "hermes"]);
  assert.deepEqual(preferences.getCollapsedProviderIds(), ["hermes", "claude"]);
});

test("appPreferences: missing storage is a no-op interface", () => {
  const preferences = createAppPreferences({ storage: null, defaultThemeId: "fallback" });
  assert.equal(preferences.getCurrentTargetId(), null);
  assert.equal(preferences.getThemeId(), "fallback");
  assert.doesNotThrow(() => preferences.setCollapsedProviderIds(["x"]));
});
