import test from "node:test";
import assert from "node:assert/strict";
import {
  canSendToProviderRuntime,
  chooseCurrentTargetAgentId,
  compactTargetSubtitle,
  findAgentEntry,
  projectAllAgentEntries,
  projectProviderAvailability,
  projectProviderState,
  projectTargetsForProvider,
  providerMetaLabel,
  providerRuntimeMiniLabel,
} from "./providerRuntimeProjection.js";

const providers = [{
  id: "demo",
  name: "Demo",
  agents: [{ id: "demo-static", providerId: "demo", state: 1 }],
}];

test("providerRuntimeProjection: runtime targets replace static agents for launch providers", () => {
  const runtimeInstances = [{ id: "demo-win", providerId: "demo", runtimeLabel: "Win", available: true, command: "demo" }];
  const targets = projectTargetsForProvider("demo", {
    providers,
    runtimeInstances,
    runtimeTargetsByInstance: {
      "demo-win": [{ id: "demo-target", name: "Demo Target" }],
    },
  });

  assert.deepEqual(targets.map((target) => target.id), ["demo-target"]);
  assert.equal(projectAllAgentEntries({ providers, runtimeInstances, runtimeTargets: targets })[0].id, "demo-target");
});

test("providerRuntimeProjection: static agent hidden when provider is managed by runtime probe", () => {
  const runtimeInstances = [{ id: "demo-win", providerId: "demo", runtimeLabel: "Win", available: true }];
  assert.equal(findAgentEntry("demo-static", { providers, runtimeInstances, runtimeTargets: [] }), null);

  const archivedProviders = [{
    id: "demo",
    agents: [{ id: "demo-archived", providerId: "demo", isArchivedAgent: true }],
  }];
  assert.equal(
    findAgentEntry("demo-archived", { providers: archivedProviders, runtimeInstances, runtimeTargets: [] }).id,
    "demo-archived",
  );
});

test("providerRuntimeProjection: chooses sendable target before activatable fallback", () => {
  const next = chooseCurrentTargetAgentId("missing", {
    agents: [
      { id: "stopped", available: false, activatable: true },
      { id: "live", available: true },
    ],
    isSelectable: (agent) => agent.available || agent.activatable,
    isSendable: (agent) => agent.available,
    isActivatable: (agent) => agent.activatable,
  });
  assert.equal(next, "live");
});

test("providerRuntimeProjection: provider state and availability summarize runtime instances", () => {
  const runtimeInstances = [
    { id: "one", providerId: "demo", available: true, configured: true },
    { id: "two", providerId: "demo", available: false, configured: true },
  ];
  assert.equal(projectProviderState(providers[0], { runtimeInstances }), 2);
  assert.deepEqual(projectProviderAvailability("demo", { runtimeInstances }), {
    summary: "partial",
    configured: true,
    available: true,
    command: "1/2",
    detail: "",
  });
});

test("providerRuntimeProjection: canSendToProviderRuntime follows launch support and target startability", () => {
  assert.equal(canSendToProviderRuntime("demo", {
    provider: providers[0],
    runtimeInstances: [{ id: "demo-win", providerId: "demo" }],
    runtimeTargets: [{ id: "target", providerId: "demo", available: false, activatable: true }],
    canStartSession: (target) => target.activatable,
  }), true);
});

test("providerRuntimeProjection: small display helpers stay pure", () => {
  const t = (key, params) => `${key}:${params?.count ?? ""}`;
  assert.equal(compactTargetSubtitle({ gateway: "running" }, { translate: t }), "availability.gatewayRunning:");
  assert.equal(providerMetaLabel(providers[0], [{ id: "target" }], [], { translate: t }), "provider.targetCount:1");
  assert.equal(providerRuntimeMiniLabel([{ runtimeLabel: "Win" }, { runtimeLabel: "Win" }, { runtimeLabel: "WSL" }]), "Win / WSL");
});
