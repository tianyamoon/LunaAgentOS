import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeAdapterCatalog, mergeSlashCommands } from "./runtimeAdapterCatalog.js";

function makeCatalog({ responses = {}, warn = () => {} } = {}) {
  const calls = [];
  const invoke = async (command, args) => {
    calls.push({ command, args });
    const response = responses[command];
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response(args) : response;
  };
  return { catalog: createRuntimeAdapterCatalog({ invoke, warn }), calls };
}

test("runtimeAdapterCatalog: probe loads adapters, icons and runtime facts", async () => {
  const { catalog, calls } = makeCatalog({
    responses: {
      load_adapters: {
        adapters: [
          { id: "claude", iconPath: "claude.svg" },
          { id: "plain" },
        ],
      },
      read_adapter_icon: { mime: "image/svg+xml", base64: "PHN2Zy8+" },
      runtime_probe: {
        providers: [{ providerId: "claude", available: true }],
        instances: [{ id: "claude-win", providerId: "claude" }],
      },
    },
  });
  const result = await catalog.probeRuntime();
  assert.deepEqual(result.adapters.map((adapter) => adapter.id), ["claude", "plain"]);
  assert.equal(result.iconEntries.claude, "data:image/svg+xml;base64,PHN2Zy8+");
  assert.deepEqual(result.providers, [{ providerId: "claude", available: true }]);
  assert.deepEqual(result.instances, [{ id: "claude-win", providerId: "claude" }]);
  assert.deepEqual(calls.map((item) => item.command), ["load_adapters", "read_adapter_icon", "runtime_probe"]);
});

test("runtimeAdapterCatalog: icon load skips broken adapters and keeps warnings local", async () => {
  const warnings = [];
  const { catalog } = makeCatalog({
    warn: (...args) => warnings.push(args),
    responses: {
      read_adapter_icon: new Error("missing"),
    },
  });
  const icons = await catalog.loadAdapterIcons([
    { id: "broken", iconPath: "x.svg" },
    { id: "no-icon" },
  ]);
  assert.deepEqual(icons, {});
  assert.equal(warnings.length, 1);
});

test("runtimeAdapterCatalog: mergeSlashCommands keeps first command per name", () => {
  assert.deepEqual(
    mergeSlashCommands([{ name: "model", value: 1 }, { name: "model", value: 2 }, { name: "clear" }, {}]),
    [{ name: "model", value: 1 }, { name: "clear" }],
  );
});

test("runtimeAdapterCatalog: slash commands load from available runtime instances only", async () => {
  const { catalog, calls } = makeCatalog({
    responses: {
      runtime_adapter_slash_commands: ({ runtimeInstanceId }) => (
        runtimeInstanceId === "a" ? [{ name: "model" }] : [{ name: "clear" }]
      ),
    },
  });
  const commands = await catalog.loadSlashCommands({
    providerId: "claude",
    runtimeInstances: [{ id: "a", available: true }, { id: "b", available: false }, { id: "c" }],
  });
  assert.deepEqual(commands.map((item) => item.name), ["model", "clear"]);
  assert.deepEqual(calls.map((item) => item.args.runtimeInstanceId), ["a", "c"]);
});

test("runtimeAdapterCatalog: targets are grouped by runtime instance", async () => {
  const { catalog, calls } = makeCatalog({
    responses: {
      runtime_adapter_targets: ({ runtimeInstanceId }) => [{ id: `${runtimeInstanceId}:target` }],
    },
  });
  const result = await catalog.loadTargets({
    providerId: "hermes",
    runtimeInstances: [{ id: "wsl", available: true }, { id: "win", available: false }],
  });
  assert.deepEqual(result, {
    targetsByInstanceId: { wsl: [{ id: "wsl:target" }] },
    loadedCount: 1,
  });
  assert.deepEqual(calls.map((item) => item.command), ["runtime_adapter_targets"]);
});
