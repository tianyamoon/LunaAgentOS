import test from "node:test";
import assert from "node:assert/strict";
import { createProvidersStore } from "./providersStore.js";

test("providersStore: default providers contain claude/hermes/trae", () => {
  const store = createProvidersStore();
  const ids = store.getProvidersRef().map((p) => p.id);
  assert.deepEqual(ids, ["claude", "hermes", "trae"]);
});

test("providersStore: getProvidersRef returns a stable array reference", () => {
  const store = createProvidersStore();
  const ref = store.getProvidersRef();
  store.setProviderNote("hermes", { note: null, noteKey: "provider.hermes.loadedNote" });
  assert.equal(store.getProvidersRef(), ref);
  store.setProviderAgents("hermes", []);
  assert.equal(store.getProvidersRef(), ref);
  store.reset();
  assert.equal(store.getProvidersRef(), ref);
});

test("providersStore: providerById returns null for unknown id", () => {
  const store = createProvidersStore();
  assert.equal(store.providerById("nope"), null);
  assert.equal(store.providerById(""), null);
  assert.equal(store.providerById(null), null);
  assert.equal(store.providerById("claude").name, "Claude Code");
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
  const ref = store.getProvidersRef();
  store.setProviderAgents("hermes", [{ id: "p1", providerId: "hermes" }]);
  assert.equal(store.getProvidersRef(), ref);
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
  const ref = store.getProvidersRef();
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
  assert.equal(store.getProvidersRef(), ref);
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

test("providersStore: runtimeAvailability stable ref + patch", () => {
  const store = createProvidersStore();
  const ref = store.getRuntimeAvailabilityRef();
  assert.equal(ref.claude.summary, "probing");
  store.patchRuntimeAvailability({
    claude: { summary: "available", configured: true, available: true, command: "claude" },
  });
  assert.equal(store.getRuntimeAvailabilityRef(), ref);
  assert.equal(ref.claude.summary, "available");
  assert.equal(store.getRuntimeAvailabilityFor("claude").available, true);
  assert.equal(store.getRuntimeAvailabilityFor("nope"), null);
});

test("providersStore: replaceRuntimeInstances mutates in place + isolates from caller", () => {
  const store = createProvidersStore();
  const ref = store.getRuntimeInstancesRef();
  const input = [{ id: "a", providerId: "claude", available: true }];
  store.replaceRuntimeInstances(input);
  assert.equal(store.getRuntimeInstancesRef(), ref);
  assert.deepEqual(ref.map((r) => r.id), ["a"]);
  input.push({ id: "leaked", providerId: "hermes" });
  assert.deepEqual(ref.map((r) => r.id), ["a"]);
  store.replaceRuntimeInstances(null);
  assert.equal(ref.length, 0);
});

test("providersStore: runtime targets per instance + prune + total count", () => {
  const store = createProvidersStore();
  const ref = store.getRuntimeTargetsByInstanceRef();
  store.setRuntimeTargetsForInstance("inst-1", [{ id: "p1" }, { id: "p2" }]);
  store.setRuntimeTargetsForInstance("inst-2", [{ id: "p3" }]);
  assert.equal(store.getRuntimeTargetsByInstanceRef(), ref);
  assert.equal(store.totalRuntimeTargetCount(), 3);
  store.pruneRuntimeTargetsByInstanceIds(["inst-2"]);
  assert.deepEqual(Object.keys(ref), ["inst-2"]);
  assert.equal(store.totalRuntimeTargetCount(), 1);
  store.pruneRuntimeTargetsByInstanceIds(["inst-2"]);
  assert.deepEqual(Object.keys(ref), ["inst-2"]);
});

test("providersStore: slash commands per provider are stable and resettable", () => {
  const store = createProvidersStore();
  const ref = store.getSlashCommandsByProviderRef();
  store.setSlashCommandsForProvider("hermes", [{ name: "demo", kind: "skill" }]);
  assert.equal(store.getSlashCommandsByProviderRef(), ref);
  assert.deepEqual(ref.hermes.map((item) => item.name), ["demo"]);
  store.setSlashCommandsForProvider("hermes", null);
  assert.deepEqual(ref.hermes, []);
  store.setSlashCommandsForProvider("hermes", [{ name: "demo" }]);
  store.reset();
  assert.deepEqual(ref, {});
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
  assert.equal(store.getRuntimeInstancesRef().length, 0);
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
