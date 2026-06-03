import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeProbeController } from "./runtimeProbeController.js";

function createProvidersStore() {
  const store = {
    providers: [{ id: "demo", loadedTargetsNoteKey: "provider.loaded" }],
    instances: [],
    runtimeTargets: {},
    notes: [],
    slashCommands: [],
    batch(callback) {
      callback();
    },
    syncAdapterProviders(adapters) {
      store.adapters = adapters;
    },
    patchRuntimeAvailability(availability) {
      store.availability = availability;
    },
    replaceRuntimeInstances(instances) {
      store.instances = instances;
    },
    pruneRuntimeTargetsByInstanceIds(ids) {
      store.prunedIds = ids;
    },
    setRuntimeTargetsForInstance(instanceId, targets) {
      store.runtimeTargets[instanceId] = targets;
    },
    totalRuntimeTargetCount() {
      return Object.values(store.runtimeTargets).flat().length;
    },
    setProviderNote(providerId, note) {
      store.notes.push({ providerId, note });
    },
    setSlashCommandsForProvider(providerId, commands) {
      store.slashCommands.push({ providerId, commands });
    },
    getRuntimeAvailabilitySnapshot() {
      return store.availability || {};
    },
  };
  return store;
}

function createController(overrides = {}) {
  const providersStore = overrides.providersStore || createProvidersStore();
  const calls = [];
  const controller = createRuntimeProbeController({
    runtimeAdapterCatalog: {
      probeRuntime: async () => ({
        adapters: [{ id: "demo" }],
        iconEntries: { demo: "icon" },
        providers: [{ providerId: "demo", summary: "available" }],
        instances: [{ id: "demo-win", providerId: "demo", available: true, configured: true }],
        raw: { ok: true },
      }),
      loadSlashCommands: async () => [{ name: "/demo" }],
      loadTargets: async () => ({
        loadedCount: 1,
        targetsByInstanceId: { "demo-win": [{ id: "target" }] },
      }),
      ...overrides.runtimeAdapterCatalog,
    },
    providersStore,
    setAdapterIconRegistry: (icons) => calls.push(["icons", icons]),
    getProvidersSnapshot: () => providersStore.providers,
    getRuntimeInstancesSnapshot: () => providersStore.instances,
    getCurrentTargetAgent: () => ({ id: "target" }),
    getAvailabilityStore: () => ({ refresh: (...args) => calls.push(["availability", args]) }),
    providerById: (id) => providersStore.providers.find((provider) => provider.id === id) || null,
    availableRuntimeInstancesForProvider: (providerId) =>
      providersStore.instances.filter((instance) => instance.providerId === providerId && instance.available),
    runtimeInstanceById: (id) => providersStore.instances.find((instance) => instance.id === id) || null,
    ensureCurrentTargetAgentExists: () => calls.push(["ensureTarget"]),
    renderProviders: () => calls.push(["providers"]),
    renderWorkspace: () => calls.push(["workspace"]),
    renderHistory: () => calls.push(["history"]),
    renderWorkspaceStatus: () => calls.push(["workspaceStatus"]),
    refreshComposerCommands: () => calls.push(["composer"]),
    setAppNotice: (text, tone) => calls.push(["notice", text, tone]),
    formatBackendError: (error) => String(error.message || error),
    t: (key, params) => `${key}:${params?.error || ""}`,
    logger: { error: (error) => calls.push(["error", String(error.message || error)]) },
    ...overrides,
  });
  return { controller, providersStore, calls };
}

test("runtimeProbeController: probe updates runtime catalog and refreshes availability", async () => {
  const { controller, providersStore, calls } = createController();
  const raw = await controller.refreshRuntimeProbe();

  assert.deepEqual(raw, { ok: true });
  assert.deepEqual(providersStore.prunedIds, ["demo-win"]);
  assert.ok(calls.some(([kind]) => kind === "availability"));
  assert.ok(calls.some(([kind]) => kind === "history"));
});

test("runtimeProbeController: load targets updates provider note and renders workspace", async () => {
  const { controller, providersStore, calls } = createController();
  providersStore.instances = [{ id: "demo-win", providerId: "demo", available: true }];

  await controller.loadRuntimeTargetsForProvider("demo");

  assert.deepEqual(providersStore.runtimeTargets["demo-win"], [{ id: "target" }]);
  assert.equal(providersStore.notes[0].note.noteKey, "provider.loaded");
  assert.ok(calls.some(([kind]) => kind === "workspace"));
});

test("runtimeProbeController: target load failure uses localized notice", async () => {
  const { controller, calls, providersStore } = createController({
    runtimeAdapterCatalog: {
      loadTargets: async () => {
        throw new Error("boom");
      },
    },
  });
  providersStore.instances = [{ id: "demo-win", providerId: "demo", available: true }];

  await controller.loadRuntimeTargetsForProvider("demo");

  assert.deepEqual(calls.at(-1), ["notice", "provider.runtimeTargetLoadFailed:boom", "error"]);
});
