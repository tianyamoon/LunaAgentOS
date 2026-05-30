import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem() { return "en-US"; },
  setItem() {},
  removeItem() {},
};

const { AgentDetailPanel } = await import("./AgentDetailPanel.js");

test("AgentDetailPanel renders identity, models, capabilities, safety, and practices", () => {
  const html = AgentDetailPanel({
    name: "Hermes / default",
    providerName: "Hermes",
    profile: "default",
    accountIdentity: "local",
    runtimeEnvironment: "WSL",
    defaultWorkingDirectory: "/repo",
    brief: "Stock review assistant",
    models: {
      available: ["qwen3"],
      defaultModel: "qwen3",
      recommended: ["qwen3-plus"],
    },
    capabilities: {
      files: { state: "enabled" },
      commands: { state: "depends", note: "Profile tools" },
      network: { state: "unknown" },
      images: { state: "unknown" },
      browser: { state: "limited" },
      localRepo: { state: "enabled" },
    },
    safety: ["Ask before writes."],
    bestPractices: ["Provide target files."],
    health: { overall: "available", fields: [] },
  });

  assert.match(html, /Hermes \/ default/);
  assert.match(html, /Stock review assistant/);
  assert.match(html, /Default working directory/);
  assert.match(html, /qwen3-plus/);
  assert.match(html, /Capability boundaries/);
  assert.match(html, /Profile tools/);
  assert.match(html, /Ask before writes\./);
  assert.match(html, /Provide target files\./);
});

test("AgentDetailPanel escapes user supplied values", () => {
  const html = AgentDetailPanel({
    name: "<script>",
    providerName: "Demo",
    models: {},
    capabilities: {},
    safety: [],
    bestPractices: [],
  });

  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
