import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeImageCapabilityStore } from "./runtimeImageCapability.js";

function initEvent(image) {
  return { type: "state", state: 0, payload: { capabilities: { promptCapabilities: { image } } } };
}

test("records promptCapabilities.image from ACP init event per provider", () => {
  const store = createRuntimeImageCapabilityStore();
  store.recordFromEvent("claude", initEvent(true));
  store.recordFromEvent("hermes", initEvent(false));
  assert.equal(store.isImageCapable("claude"), true);
  assert.equal(store.isImageCapable("hermes"), false);
});

test("returns undefined for unknown providers (process not started)", () => {
  const store = createRuntimeImageCapabilityStore();
  assert.equal(store.isImageCapable("codex"), undefined);
});

test("ignores non-init events and missing capability fields", () => {
  const store = createRuntimeImageCapabilityStore();
  // 非 state:0 事件不更新。
  store.recordFromEvent("claude", { type: "state", state: 1, payload: {} });
  store.recordFromEvent("claude", { type: "response", payload: { content: "x" } });
  assert.equal(store.isImageCapable("claude"), undefined);
  // 缺 promptCapabilities.image 字段时不写入。
  store.recordFromEvent("claude", { type: "state", state: 0, payload: { capabilities: {} } });
  assert.equal(store.isImageCapable("claude"), undefined);
});

test("reset clears all cached capabilities", () => {
  const store = createRuntimeImageCapabilityStore();
  store.recordFromEvent("claude", initEvent(true));
  store.reset();
  assert.equal(store.isImageCapable("claude"), undefined);
});
