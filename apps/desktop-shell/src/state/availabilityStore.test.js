import test from "node:test";
import assert from "node:assert/strict";
import { createAvailabilityStore, getAvailabilityStore } from "./availabilityStore.js";

test("createAvailabilityStore returns singleton", () => {
  const store1 = createAvailabilityStore();
  const store2 = createAvailabilityStore();
  assert.strictEqual(store1, store2);
});

test("getAvailabilityStore returns same instance", () => {
  const store = getAvailabilityStore();
  const store2 = getAvailabilityStore();
  assert.strictEqual(store, store2);
});

test("refresh aggregates provider stats", () => {
  const store = createAvailabilityStore();
  const providers = [
    { id: "hermes", name: "Hermes" },
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex" },
  ];
  const instances = [
    { id: "hermes-wsl", providerId: "hermes", available: true, runtimeLabel: "WSL" },
    { id: "claude-win", providerId: "claude", available: true, runtimeLabel: "Win" },
  ];

  const data = store.refresh(providers, instances, null);

  assert.strictEqual(data.summary.providers.total, 3);
  assert.strictEqual(data.summary.runtimes.total, 2);
  assert.strictEqual(data.summary.runtimes.available, 2);
  assert.ok(data.lastCheck);
});

test("refresh attaches structured health reasons to runtimes and targets", () => {
  const store = createAvailabilityStore();
  const providers = [
    {
      id: "demo",
      name: "Demo Agent",
      agents: [
        {
          id: "demo-profile",
          providerId: "demo",
          kind: "profile",
          available: false,
          activatable: true,
          profileName: "default",
          profileExecutable: "demo",
        },
      ],
    },
  ];
  const instances = [
    {
      id: "demo-runtime",
      providerId: "demo",
      available: false,
      configured: true,
      runtimeLabel: "Local",
      commandKind: "bridge",
      detail: "bridge is not responding",
    },
  ];

  const data = store.refresh(providers, instances, providers[0].agents[0], {
    demo: {
      configured: true,
      available: false,
      summary: "unavailable",
      detail: "0 / 1 runtime available",
    },
  });

  assert.equal(data.providers[0].health.cli_callable, "failed");
  assert.equal(data.providers[0].instances[0].health.wsl_or_bridge_available, "failed");
  assert.equal(data.providers[0].targets[0].health.unavailable_reason, "runtime_stopped");
  assert.equal(data.providers[0].targets[0].health.repair_hint, "send_to_connect");
  assert.equal(data.problems.length, 2);
});

test("subscribe notifies on refresh", async () => {
  const store = createAvailabilityStore();
  let called = false;
  const dispose = store.subscribe(() => {
    called = true;
  });

  store.refresh([], [], null);
  assert.strictEqual(called, true);

  dispose();
});
