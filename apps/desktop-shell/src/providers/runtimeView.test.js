import test from "node:test";
import assert from "node:assert/strict";
import {
  runtimeInstancesForProvider,
  availableRuntimeInstancesForProvider,
  runtimeInstanceById,
  providerRuntimeLabel,
  targetsForRuntimeInstance,
  runtimeTargets,
  sortTargetsForAgentList,
} from "./runtimeView.js";

const claudeProvider = { id: "claude", name: "Claude Code" };
const hermesProvider = { id: "hermes", name: "Hermes" };

const claudeWin = {
  id: "claude-win",
  providerId: "claude",
  runtimeLabel: "Win",
  available: true,
  command: "claude.cmd",
};
const claudeWsl = {
  id: "claude-wsl",
  providerId: "claude",
  runtimeLabel: "WSL",
  available: true,
  command: "wsl.exe",
};
const hermesWsl = {
  id: "hermes-wsl",
  providerId: "hermes",
  runtimeLabel: "WSL",
  available: true,
  command: "hermes",
};
const hermesUnavailable = {
  id: "hermes-win",
  providerId: "hermes",
  runtimeLabel: "Win",
  available: false,
  command: "hermes.exe",
};

test("runtimeInstancesForProvider filters by providerId", () => {
  const instances = [claudeWin, claudeWsl, hermesWsl];
  assert.deepEqual(
    runtimeInstancesForProvider(instances, "claude").map((i) => i.id),
    ["claude-win", "claude-wsl"],
  );
  assert.deepEqual(runtimeInstancesForProvider(instances, "hermes").map((i) => i.id), ["hermes-wsl"]);
  assert.deepEqual(runtimeInstancesForProvider(null, "claude"), []);
});

test("availableRuntimeInstancesForProvider drops unavailable instances", () => {
  const instances = [claudeWin, hermesUnavailable, hermesWsl];
  const available = availableRuntimeInstancesForProvider(instances, "hermes");
  assert.deepEqual(available.map((i) => i.id), ["hermes-wsl"]);
});

test("runtimeInstanceById returns null when missing or empty input", () => {
  assert.equal(runtimeInstanceById([claudeWin], "claude-win").id, "claude-win");
  assert.equal(runtimeInstanceById([claudeWin], "missing"), null);
  assert.equal(runtimeInstanceById(null, "claude-win"), null);
  assert.equal(runtimeInstanceById([claudeWin], null), null);
});

test("providerRuntimeLabel keeps runtime label visible", () => {
  assert.equal(providerRuntimeLabel(claudeProvider, claudeWin, 1), "Claude Code · Win");
  assert.equal(providerRuntimeLabel(claudeProvider, claudeWin, 2), "Claude Code · Win");
  assert.equal(providerRuntimeLabel(claudeProvider, claudeWsl, 2), "Claude Code · WSL");
  assert.equal(providerRuntimeLabel(claudeProvider, { runtimeLabel: null }, 1), "Claude Code");
});

test("targetsForRuntimeInstance: claude produces a runtime kind row", () => {
  const targets = targetsForRuntimeInstance(claudeWin, {
    providers: [claudeProvider],
    runtimeInstances: [claudeWin],
    runtimeTargetsByInstance: {},
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].kind, "runtime");
  assert.equal(targets[0].providerId, "claude");
  assert.equal(targets[0].runtimeInstanceId, "claude-win");
  assert.equal(targets[0].name, "Claude Code · Win");
});

test("targetsForRuntimeInstance: hermes expands hermes profiles", () => {
  const profiles = [
    {
      id: "hermes-wsl:profile:default",
      displayName: "default",
      profileName: "default",
      alias: null,
      model: "qwen3.6-plus",
      isDefault: true,
    },
    {
      id: "hermes-wsl:profile:ailearing",
      displayName: "ailearing",
      profileName: "ailearing",
      alias: "ailearing",
      model: "qwen3.6-plus",
    },
  ];
  const targets = targetsForRuntimeInstance(hermesWsl, {
    providers: [hermesProvider],
    runtimeInstances: [hermesWsl],
    runtimeTargetsByInstance: { "hermes-wsl": profiles },
  });
  assert.equal(targets.length, 2);
  assert.equal(targets[0].kind, "profile");
  assert.equal(targets[0].profileExecutable, null); // default has alias=null
  assert.equal(targets[1].profileExecutable, "ailearing");
  assert.equal(targets[0].isDefault, true);
});

test("targetsForRuntimeInstance: stopped hermes profiles stay visible but unavailable", () => {
  const profiles = [
    {
      id: "hermes-wsl:profile:stopped",
      displayName: "stopped",
      profileName: "stopped",
      alias: "stopped",
      model: "qwen3.6-plus",
      gateway: "stopped",
      state: 9,
    },
  ];
  const targets = targetsForRuntimeInstance(hermesWsl, {
    providers: [hermesProvider],
    runtimeInstances: [hermesWsl],
    runtimeTargetsByInstance: { "hermes-wsl": profiles },
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].gateway, "stopped");
  assert.equal(targets[0].available, false);
});

test("sortTargetsForAgentList moves stopped targets to the bottom stably", () => {
  const targets = sortTargetsForAgentList([
    { id: "stopped-a", providerId: "hermes", gateway: "stopped", available: false },
    { id: "running-a", providerId: "hermes", gateway: "running", available: true },
    { id: "running-b", providerId: "claude", available: true },
    { id: "stopped-b", providerId: "hermes", state: 9, available: false },
  ]);
  assert.deepEqual(targets.map((target) => target.id), [
    "running-a",
    "running-b",
    "stopped-a",
    "stopped-b",
  ]);
});

test("targetsForRuntimeInstance: unavailable instances yield no targets", () => {
  const targets = targetsForRuntimeInstance(hermesUnavailable, {
    providers: [hermesProvider],
    runtimeInstances: [hermesUnavailable],
    runtimeTargetsByInstance: { "hermes-win": [{ id: "hermes-win:profile:x", displayName: "x" }] },
  });
  assert.deepEqual(targets, []);
});

test("targetsForRuntimeInstance: unknown provider yields no targets", () => {
  const targets = targetsForRuntimeInstance(
    { id: "unknown", providerId: "trae", available: true, runtimeLabel: "IDE" },
    { providers: [claudeProvider], runtimeInstances: [], runtimeTargetsByInstance: {} },
  );
  assert.deepEqual(targets, []);
});

test("targetsForRuntimeInstance: identityOnly provider does not produce a launch row", () => {
  const targets = targetsForRuntimeInstance(
    { id: "trae-bridge", providerId: "trae", available: true, runtimeLabel: "IDE" },
    {
      providers: [{ id: "trae", name: "Trae IDE", identityOnly: true }],
      runtimeInstances: [],
      runtimeTargetsByInstance: {},
    },
  );
  assert.deepEqual(targets, []);
});

test("targetsForRuntimeInstance: manifest adapter produces a generic runtime row", () => {
  const codexProvider = { id: "codex", name: "OpenAI Codex", dynamicAdapter: true };
  const codexInstance = {
    id: "codex-manifest",
    providerId: "codex",
    runtimeLabel: "Manifest",
    commandKind: "manifest",
    command: "npx -y @openai/codex",
    transport: "stdio_json",
    available: true,
  };
  const targets = targetsForRuntimeInstance(codexInstance, {
    providers: [codexProvider],
    runtimeInstances: [codexInstance],
    runtimeTargetsByInstance: {},
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].providerId, "codex");
  assert.equal(targets[0].runtimeCommand, null);
  assert.equal(targets[0].subtitle, "stdio_json");
});

test("runtimeTargets: flattens across all instances", () => {
  const profiles = [{ id: "hermes-wsl:profile:default", displayName: "default" }];
  const all = runtimeTargets({
    providers: [claudeProvider, hermesProvider],
    runtimeInstances: [claudeWin, hermesWsl, hermesUnavailable],
    runtimeTargetsByInstance: { "hermes-wsl": profiles },
  });
  assert.equal(all.length, 2);
  const ids = all.map((target) => target.id).sort();
  assert.deepEqual(ids, ["claude-win", "hermes-wsl:profile:default"]);
});

test("runtimeTargets: empty input yields empty result", () => {
  assert.deepEqual(
    runtimeTargets({ providers: [], runtimeInstances: null, runtimeTargetsByInstance: null }),
    [],
  );
});
