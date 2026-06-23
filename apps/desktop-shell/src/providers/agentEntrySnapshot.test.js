import test from "node:test";
import assert from "node:assert/strict";
import {
  matchAgentEntry,
  readLegacyHermesSnapshot,
  snapshotAgentEntry,
  snapshotRuntimeSession,
} from "./agentEntrySnapshot.js";

test("snapshotAgentEntry: profile target becomes a generic snapshot", () => {
  const snapshot = snapshotAgentEntry({
    id: "demo-wsl:profile:writer",
    providerId: "demo",
    runtimeInstanceId: "demo-wsl",
    runtimeLabel: "WSL",
    runtimeHost: "wsl",
    runtimeCommand: "demo",
    profileName: "writer",
    profileAlias: "/root/bin/writer",
    metadata: { model: "qwen" },
  });
  assert.equal(snapshot.providerId, "demo");
  assert.equal(snapshot.launch.profileExecutable, "/root/bin/writer");
  assert.deepEqual(snapshot.metadata, { model: "qwen" });
  assert.equal(snapshot.identityKeys.includes("writer"), true);
});

test("snapshotRuntimeSession: ordinary runtime remains adapter neutral", () => {
  const snapshot = snapshotRuntimeSession({
    agentId: "codex-main",
    providerId: "codex",
    targetId: "codex-main",
    agentName: "OpenAI Codex",
    runtimeInstanceId: "codex-manifest",
    runtimeLabel: "Manifest",
    runtimeHost: "manifest",
    runtimeCommand: null,
  });
  assert.equal(snapshot.targetId, "codex-main");
  assert.equal(snapshot.launch.runtimeCommand, null);
  assert.deepEqual(snapshot.identityKeys, ["codex-main"]);
});

test("readLegacyHermesSnapshot: legacy profile is isolated behind compatibility seam", () => {
  const snapshot = readLegacyHermesSnapshot({
    agentId: "hermes-main",
    providerId: "hermes",
    turns: [{ meta: { hermesProfile: { profileName: "default", profileModel: "qwen" } } }],
  });
  assert.equal(snapshot.providerId, "hermes");
  assert.equal(snapshot.identityKeys.includes("default"), true);
  assert.deepEqual(snapshot.metadata.legacyHermesProfile, {
    profileName: "default",
    profileModel: "qwen",
  });
});

test("matchAgentEntry: provider and identity keys select the live entry", () => {
  const snapshot = snapshotAgentEntry({
    id: "old-id",
    providerId: "demo",
    profileAlias: "/root/bin/writer",
  });
  const matched = matchAgentEntry(snapshot, [
    { id: "other", providerId: "other", profileAlias: "/root/bin/writer" },
    { id: "new-id", providerId: "demo", profileAlias: "/root/bin/writer" },
  ]);
  assert.equal(matched.id, "new-id");
});
