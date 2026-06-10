import test from "node:test";
import assert from "node:assert/strict";

import { buildAgentDetail } from "./agentDetail.js";

test("buildAgentDetail merges provider metadata, runtime, target, and health", () => {
  const detail = buildAgentDetail({
    provider: {
      id: "demo",
      name: "Demo Agent",
      agentDetail: {
        summary: "Provider summary",
        defaultWorkingDirectory: "/repo",
        models: {
          available: ["fast", "deep"],
          default: "fast",
          recommended: ["deep"],
        },
        capabilities: {
          files: true,
          commands: { state: "limited", noteKey: "agentDetail.demo.commands" },
          browser: false,
        },
        safetyBoundaries: ["Ask before destructive commands."],
        bestPractices: ["Give a clear scope."],
      },
    },
    runtimeInstance: {
      id: "demo-win",
      runtimeLabel: "Windows",
      command: "demo",
    },
    target: {
      id: "demo-target",
      providerId: "demo",
      profileName: "default",
      accountIdentity: "user@example.test",
      model: "fast",
    },
    availabilityTarget: {
      health: { overall: "available" },
    },
  });

  assert.equal(detail.providerName, "Demo Agent");
  assert.equal(detail.profile, "default");
  assert.equal(detail.accountIdentity, "user@example.test");
  assert.equal(detail.runtimeEnvironment, "Windows");
  assert.equal(detail.runtimeCommand, "demo");
  assert.equal(detail.defaultWorkingDirectory, "/repo");
  assert.deepEqual(detail.models.available, ["fast", "deep"]);
  assert.equal(detail.models.defaultModel, "fast");
  assert.deepEqual(detail.models.recommended, ["deep"]);
  assert.equal(detail.capabilities.files.state, "enabled");
  assert.equal(detail.capabilities.commands.state, "limited");
  assert.equal(detail.capabilities.commands.noteKey, "agentDetail.demo.commands");
  assert.equal(detail.capabilities.browser.state, "unavailable");
  assert.equal(detail.health.overall, "available");
});

test("buildAgentDetail lets target fields override provider detail", () => {
  const detail = buildAgentDetail({
    provider: {
      id: "demo",
      name: "Demo",
      agentDetail: {
        summary: "Provider summary",
        capabilities: { network: false },
      },
    },
    target: {
      id: "target",
      name: "Target",
      providerId: "demo",
      runtimeHost: "WSL",
      defaultWorkingDirectory: "/target",
      capabilities: { network: true },
      agentDetail: {
        summary: "Target summary",
        bestPractices: ["Target practice"],
      },
    },
  });

  assert.equal(detail.name, "Target");
  assert.equal(detail.runtimeEnvironment, "WSL");
  assert.equal(detail.defaultWorkingDirectory, "/target");
  assert.equal(detail.brief, "Target summary");
  assert.equal(detail.capabilities.network.state, "enabled");
  assert.deepEqual(detail.bestPractices, ["Target practice"]);
});

test("buildAgentDetail applies saved model only to declared Luna-managed controls", () => {
  const detail = buildAgentDetail({
    provider: { id: "demo", name: "Demo", modelControl: { mode: "luna_managed", availableModels: ["fast", "deep"] } },
    target: { id: "target", providerId: "demo" },
    savedDefaultModel: "deep",
  });
  assert.equal(detail.models.defaultModel, "deep");
  assert.equal(detail.models.control.mode, "luna_managed");
});
