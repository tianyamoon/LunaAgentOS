import test from "node:test";
import assert from "node:assert/strict";
import { createProvidersStore } from "./providersStore.js";

test("providersStore: default providers contain claude/hermes/trae", () => {
  const store = createProvidersStore();
  const ids = store.getProvidersSnapshot().map((p) => p.id);
  assert.deepEqual(ids, ["claude", "hermes", "trae"]);
});

test("providersStore: provider snapshots isolate callers", () => {
  const store = createProvidersStore();
  const snapshot = store.getProvidersSnapshot();
  store.setProviderNote("hermes", { note: null, noteKey: "provider.hermes.loadedNote" });
  store.setProviderAgents("hermes", []);
  snapshot.push({ id: "leaked" });
  snapshot.find((provider) => provider.id === "hermes").agents.push({ id: "leaked-agent" });
  snapshot.find((provider) => provider.id === "claude").agentDetail.models.available.push("leaked-model");
  assert.equal(store.getProvidersSnapshot().some((provider) => provider.id === "leaked"), false);
  assert.deepEqual(store.providerById("hermes").agents, []);
  assert.deepEqual(store.providerById("claude").agentDetail.models.available, ["agentDetail.model.nativeRuntime"]);
  store.reset();
  assert.deepEqual(store.getProvidersSnapshot().map((provider) => provider.id), ["claude", "hermes", "trae"]);
});

test("providersStore: providerById returns null for unknown id", () => {
  const store = createProvidersStore();
  assert.equal(store.providerById("nope"), null);
  assert.equal(store.providerById(""), null);
  assert.equal(store.providerById(null), null);
  const claude = store.providerById("claude");
  assert.equal(claude.name, "Claude Code");
  claude.agentDetail.models.available.push("leaked-model");
  assert.deepEqual(store.providerById("claude").agentDetail.models.available, ["agentDetail.model.nativeRuntime"]);
});

test("providersStore: setProviderNote replaces note/noteKey/noteParams", () => {
  const store = createProvidersStore();
  store.setProviderNote("hermes", {
    note: null,
    noteKey: "provider.hermes.loadedNote",
    noteParams: { count: 3 },
  });
  const hermes = store.providerById("hermes");
  assert.equal(hermes.note, null);
  assert.equal(hermes.noteKey, "provider.hermes.loadedNote");
  assert.deepEqual(hermes.noteParams, { count: 3 });
});

test("providersStore: setProviderAgents replaces agents in place", () => {
  const store = createProvidersStore();
  store.setProviderAgents("hermes", [{ id: "p1", providerId: "hermes" }]);
  assert.deepEqual(
    store.providerById("hermes").agents.map((a) => a.id),
    ["p1"],
  );
  store.setProviderAgents("hermes", null);
  assert.deepEqual(store.providerById("hermes").agents, []);
});

test("providersStore: appendProviderAgent / removeProviderAgent", () => {
  const store = createProvidersStore();
  store.setProviderAgents("hermes", []);
  store.appendProviderAgent("hermes", { id: "wsl-profile", providerId: "hermes" });
  assert.equal(store.providerById("hermes").agents.length, 1);
  store.removeProviderAgent("hermes", "wsl-profile");
  assert.equal(store.providerById("hermes").agents.length, 0);
  store.removeProviderAgent("hermes", "missing");
  assert.equal(store.providerById("hermes").agents.length, 0);
});

test("providersStore: syncAdapterProviders marks built-ins and prunes manifest providers", () => {
  const store = createProvidersStore();
  store.syncAdapterProviders([
    {
      id: "codex",
      name: "OpenAI Codex",
      transport: "stdio_json",
      capabilities: { slashCommands: [{ name: "compact" }] },
    },
    {
      id: "claude",
      name: "Ignored Claude Manifest",
      transport: "stdio_json",
      capabilities: { slashCommands: [{ name: "model" }] },
    },
  ]);
  assert.equal(store.providerById("claude").dynamicAdapter, true);
  assert.equal(store.providerById("codex").dynamicAdapter, true);
  assert.deepEqual(
    store.providerById("claude").adapterManifest.capabilities.slashCommands.map((item) => item.name),
    ["model"],
  );
  assert.deepEqual(
    store.providerById("codex").adapterManifest.capabilities.slashCommands.map((item) => item.name),
    ["compact"],
  );
  assert.deepEqual(store.providerById("codex").agents.map((agent) => agent.id), ["codex-main"]);
  assert.equal(store.getRuntimeAvailabilityFor("codex").configured, true);
  store.syncAdapterProviders([]);
  assert.equal(store.providerById("claude").dynamicAdapter, undefined);
  assert.equal(store.providerById("codex"), null);
  assert.equal(store.getRuntimeAvailabilityFor("codex"), null);
});

test("providersStore: runtimeAvailability snapshot + patch", () => {
  const store = createProvidersStore();
  const snapshot = store.getRuntimeAvailabilitySnapshot();
  assert.equal(snapshot.claude.summary, "probing");
  store.patchRuntimeAvailability({
    claude: { summary: "available", configured: true, available: true, command: "claude" },
  });
  assert.equal(snapshot.claude.summary, "probing");
  assert.equal(store.getRuntimeAvailabilitySnapshot().claude.summary, "available");
  assert.equal(store.getRuntimeAvailabilityFor("claude").available, true);
  assert.equal(store.getRuntimeAvailabilityFor("nope"), null);
});

test("providersStore: runtime instance snapshots isolate callers", () => {
  const store = createProvidersStore();
  const input = [{ id: "a", providerId: "claude", available: true }];
  store.replaceRuntimeInstances(input);
  const snapshot = store.getRuntimeInstancesSnapshot();
  assert.deepEqual(snapshot.map((r) => r.id), ["a"]);
  input.push({ id: "leaked", providerId: "hermes" });
  input[0].id = "mutated-input";
  snapshot.push({ id: "mutated-snapshot" });
  snapshot[0].id = "mutated-instance";
  assert.deepEqual(store.getRuntimeInstancesSnapshot().map((r) => r.id), ["a"]);
  store.replaceRuntimeInstances(null);
  assert.equal(store.getRuntimeInstancesSnapshot().length, 0);
});

test("providersStore: runtime targets per instance + prune + total count", () => {
  const store = createProvidersStore();
  store.setRuntimeTargetsForInstance("inst-1", [{ id: "p1" }, { id: "p2" }]);
  store.setRuntimeTargetsForInstance("inst-2", [{ id: "p3" }]);
  const snapshot = store.getRuntimeTargetsByInstanceSnapshot();
  assert.deepEqual(snapshot["inst-1"].map((item) => item.id), ["p1", "p2"]);
  snapshot["inst-1"].push({ id: "leaked" });
  assert.deepEqual(store.getRuntimeTargetsByInstanceSnapshot()["inst-1"].map((item) => item.id), ["p1", "p2"]);
  assert.equal(store.totalRuntimeTargetCount(), 3);
  store.pruneRuntimeTargetsByInstanceIds(["inst-2"]);
  assert.deepEqual(Object.keys(store.getRuntimeTargetsByInstanceSnapshot()), ["inst-2"]);
  assert.equal(store.totalRuntimeTargetCount(), 1);
  store.pruneRuntimeTargetsByInstanceIds(["inst-2"]);
  assert.deepEqual(Object.keys(store.getRuntimeTargetsByInstanceSnapshot()), ["inst-2"]);
});

test("providersStore: slash commands per provider are stable and resettable", () => {
  const store = createProvidersStore();
  store.setSlashCommandsForProvider("hermes", [{ name: "demo", kind: "skill" }]);
  assert.deepEqual(store.getSlashCommandsForProvider("hermes").map((item) => item.name), ["demo"]);
  store.setSlashCommandsForProvider("hermes", null);
  assert.deepEqual(store.getSlashCommandsForProvider("hermes"), []);
  store.setSlashCommandsForProvider("hermes", [{ name: "demo" }]);
  store.reset();
  assert.deepEqual(store.getSlashCommandsForProvider("hermes"), []);
});

test("providersStore: subscribe is notified on each mutation, batched in batch()", () => {
  const store = createProvidersStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.setProviderNote("hermes", { note: "n1" });
  assert.equal(notifyCount, 1);
  store.setRuntimeTargetsForInstance("inst-1", []);
  assert.equal(notifyCount, 2);
  store.batch(() => {
    store.replaceRuntimeInstances([{ id: "a", providerId: "claude" }]);
    store.patchRuntimeAvailability({
      claude: { summary: "available", configured: true, available: true, command: "x" },
    });
    store.setProviderAgents("hermes", []);
  });
  assert.equal(notifyCount, 3);
});

test("providersStore: reset restores defaults and notifies", () => {
  const store = createProvidersStore();
  store.replaceRuntimeInstances([{ id: "a", providerId: "claude" }]);
  store.setRuntimeTargetsForInstance("inst-1", [{ id: "p1" }]);
  store.setProviderAgents("hermes", []);
  store.patchRuntimeAvailability({
    claude: { summary: "available", configured: true, available: true, command: "x" },
  });
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.reset();
  assert.equal(notifyCount, 1);
  assert.equal(store.getRuntimeInstancesSnapshot().length, 0);
  assert.equal(store.totalRuntimeTargetCount(), 0);
  assert.equal(store.getRuntimeAvailabilityFor("claude").summary, "probing");
  assert.equal(store.providerById("hermes").agents.length, 1);
});

test("providersStore: subscribe disposer stops further notifications", () => {
  const store = createProvidersStore();
  let notifyCount = 0;
  const off = store.subscribe(() => {
    notifyCount += 1;
  });
  store.setProviderNote("claude", { note: "n1" });
  off();
  store.setProviderNote("claude", { note: "n2" });
  assert.equal(notifyCount, 1);
});
