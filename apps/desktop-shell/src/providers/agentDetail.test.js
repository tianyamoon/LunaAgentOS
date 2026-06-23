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
  // 探测得到的 runtimeHost 映射为可读标签 key（渲染时 t() 翻译），而非裸 token。
  assert.equal(detail.runtimeEnvironment, "agentDetail.runtimeHost.wsl");
  assert.equal(detail.defaultWorkingDirectory, "/target");
  assert.equal(detail.brief, "Target summary");
  assert.equal(detail.capabilities.network.state, "enabled");
  assert.deepEqual(detail.bestPractices, ["Target practice"]);
});

test("buildAgentDetail: verifiable runtime host beats provider's static runtime label", () => {
  // 内建 provider 带静态 runtimeEnvironmentKey（"Windows / WSL"），但 target 探测到真实 host。
  // 真实 host 必须胜出，不能被静态默认标签掩盖。
  const detail = buildAgentDetail({
    provider: {
      id: "claude",
      name: "Claude Code",
      agentDetail: { runtimeEnvironmentKey: "agentDetail.runtime.windowsWsl" },
    },
    target: { id: "claude-native", providerId: "claude", runtimeHost: "native" },
  });
  assert.equal(detail.runtimeEnvironment, "agentDetail.runtimeHost.native");
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
