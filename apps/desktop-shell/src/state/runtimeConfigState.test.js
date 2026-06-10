import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeConfigState, normalizedAgentBriefs, normalizedAgentPreferences } from "./runtimeConfigState.js";

function makeState({ responses = {}, now = () => "2026-06-03T10:00:00.000Z" } = {}) {
  const calls = [];
  const invoke = async (command, args) => {
    calls.push({ command, args });
    const response = responses[command];
    return typeof response === "function" ? response(args) : response;
  };
  return { state: createRuntimeConfigState({ invoke, now }), calls };
}

test("runtimeConfigState: normalizes agent briefs and isolates snapshots", () => {
  const source = { a: { "zh-CN": { text: "测试" } } };
  const briefs = normalizedAgentBriefs(source);
  briefs.a["zh-CN"].text = "leaked";
  assert.equal(source.a["zh-CN"].text, "测试");
  assert.equal(normalizedAgentBriefs(null)["zh-CN"], undefined);

  const { state } = makeState();
  const snapshot = state.getAgentBriefsSnapshot();
  snapshot.x = { text: "external" };
  assert.deepEqual(state.getAgentBriefsSnapshot(), {});
});

test("runtimeConfigState: loads runtime config and reads target brief", async () => {
  const { state, calls } = makeState({
    responses: {
      load_runtime_config: {
        agentBriefs: {
          "hermes:wsl:default": {
            "zh-CN": { text: "股票复盘助手" },
          },
        },
      },
    },
  });
  await state.load();
  const target = { providerId: "hermes", runtimeHost: "wsl", profileName: "default" };
  assert.equal(state.targetBriefText(target, { language: "zh-CN", translate: (key) => `t:${key}` }), "股票复盘助手");
  assert.equal(state.targetBriefInputValue(target, "zh-CN"), "股票复盘助手");
  assert.deepEqual(calls.map((item) => item.command), ["load_runtime_config"]);
});

test("runtimeConfigState: fallback brief uses explicit text before translation key", async () => {
  const { state } = makeState({ responses: { load_runtime_config: {} } });
  await state.load();
  assert.equal(
    state.targetBriefText({ brief: "自定义职责", providerId: "unknown" }, { language: "zh-CN", translate: (key) => `t:${key}` }),
    "自定义职责",
  );
  assert.match(
    state.targetBriefText({ providerId: "unknown" }, { language: "zh-CN", translate: (key) => `t:${key}` }),
    /^t:/,
  );
});

test("runtimeConfigState: saves brief records without leaking caller objects", async () => {
  const { state, calls } = makeState({
    responses: {
      load_runtime_config: { theme: "dark" },
      save_runtime_config: ({ config }) => config,
    },
  });
  const next = {};
  const target = { providerId: "claude", runtimeHost: "win", profileName: "default" };
  state.writeBriefValue(next, target, "zh-CN", "全栈工程师", "manual");
  await state.saveAgentBriefRecords(next);
  next["claude:win:default"]["zh-CN"].text = "leaked";
  assert.equal(state.targetBriefInputValue(target, "zh-CN"), "全栈工程师");
  assert.deepEqual(calls.map((item) => item.command), ["load_runtime_config", "save_runtime_config"]);
  assert.equal(calls[1].args.config.theme, "dark");
});

test("runtimeConfigState: empty brief removes language and parent key", () => {
  const { state } = makeState();
  const next = { "claude:win:default": { "zh-CN": { text: "全栈工程师" } } };
  state.writeBriefValue(next, { providerId: "claude", runtimeHost: "win", profileName: "default" }, "zh-CN", "");
  assert.deepEqual(next, {});
});

test("runtimeConfigState: saves model preference while preserving other runtime config", async () => {
  const { state, calls } = makeState({ responses: {
    load_runtime_config: { theme: "dark", agentBriefs: { keep: {} } },
    save_runtime_config: ({ config }) => config,
  } });
  const target = { providerId: "demo", runtimeHost: "win", name: "main" };
  await state.load();
  await state.saveDefaultModel(target, "deep");
  assert.equal(state.defaultModelForTarget(target), "deep");
  assert.equal(calls.at(-1).args.config.theme, "dark");
  assert.deepEqual(calls.at(-1).args.config.agentBriefs, { keep: {} });
  assert.deepEqual(normalizedAgentPreferences(null), {});
});
