import test from "node:test";
import assert from "node:assert/strict";
import {
  projectSessionFromArchived,
  restoreAgentEntryFromArchived,
} from "./sessionRestoreProjection.js";

// 创建普通 Adapter 的最小归档数据。
function makeArchived(overrides = {}) {
  return {
    id: "session-1",
    providerId: "demo",
    providerName: "Demo",
    agentId: "demo-main",
    agentName: "Demo",
    targetId: "demo-main",
    targetName: "Demo",
    title: "task",
    turns: [],
    createdAt: "2026-06-01T00:00:00Z",
    acpSessionId: "acp-1",
    ...overrides,
  };
}

// 创建投影所需的默认依赖，测试可以按场景覆盖。
function projectionOptions(overrides = {}) {
  return {
    runtimeInstances: [],
    runtimeDefaultsForProvider: () => ({
      runtimeInstanceId: "demo-win",
      runtimeLabel: "Win",
      runtimeHost: "native",
      runtimeCommand: null,
    }),
    runtimeHostForInstance: (instance) => instance.host,
    ...overrides,
  };
}

test("sessionRestoreProjection: ordinary adapter snapshot matches a live entry", () => {
  const archived = makeArchived({
    agentEntrySnapshot: {
      agentId: "demo-main",
      providerId: "demo",
      targetId: "demo-main",
      identityKeys: ["demo-main"],
      launch: { runtimeHost: "native", runtimeCommand: "demo" },
      metadata: {},
    },
  });
  const entry = restoreAgentEntryFromArchived(archived, [
    { id: "demo-main", providerId: "demo", runtimeInstanceId: "demo-win" },
  ]);
  assert.equal(entry.id, "demo-main");
  assert.equal(entry.runtimeInstanceId, "demo-win");
});

test("sessionRestoreProjection: legacy Hermes profile enters through compatibility snapshot", () => {
  const archived = makeArchived({
    providerId: "hermes",
    agentId: "hermes-wsl:profile:default",
    hermesProfile: { profileName: "default", profileAlias: "default", profileModel: "qwen" },
  });
  const entry = restoreAgentEntryFromArchived(archived);
  assert.equal(entry.profileName, "default");
  assert.equal(entry.profileAlias, "default");
  assert.equal(entry.profileModel, "qwen");
});

test("sessionRestoreProjection: missing runtime uses provider defaults", () => {
  const restored = projectSessionFromArchived(makeArchived(), projectionOptions());
  assert.equal(restored.runtimeInstanceId, "demo-win");
  assert.equal(restored.runtimeLabel, "Win");
  assert.equal(restored.runtimeHost, "native");
  assert.equal(restored.inWorkspace, true);
});

test("sessionRestoreProjection: runtime instance fills host before provider defaults", () => {
  const restored = projectSessionFromArchived(makeArchived({ runtimeInstanceId: "demo-wsl" }), projectionOptions({
    runtimeInstances: [{ id: "demo-wsl", runtimeLabel: "WSL", host: "wsl", command: "demo", commandKind: "shell" }],
  }));
  assert.equal(restored.runtimeLabel, "WSL");
  assert.equal(restored.runtimeHost, "wsl");
  assert.equal(restored.runtimeCommand, "demo");
});

test("sessionRestoreProjection: existing session is merged in place without overwriting live fields", () => {
  const existing = { id: "session-1", runtimeLabel: "Live", turns: [] };
  const restored = projectSessionFromArchived(makeArchived(), projectionOptions({
    existing,
    agentEntry: { runtimeLabel: "Snapshot", adapterMetadata: { profileName: "default" } },
  }));
  assert.equal(restored, existing);
  assert.equal(restored.runtimeLabel, "Live");
  assert.equal(restored.profileName, "default");
});
