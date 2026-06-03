import test from "node:test";
import assert from "node:assert/strict";

import { createAgentBriefController } from "./agentBriefController.js";

function makeHarness(overrides = {}) {
  const calls = [];
  const turn = { outputs: [], finalResponse: "{\"zh-CN\":\"中文职责\",\"en-US\":\"English brief\"}" };
  const session = { id: "session-a" };
  const briefs = {};
  const target = { id: "agent-a", providerId: "provider-a", name: "Agent A" };
  const controller = createAgentBriefController({
    isTargetSendable: () => true,
    acpCommandsForProvider: () => ({ prompt: "runtime_acp_adapter_prompt" }),
    buildAgentBriefPrompt: () => "brief prompt",
    createSessionForAgent: () => session,
    saveCurrentTargetAgent: (id) => calls.push(["target", id]),
    saveCurrentSession: (id) => calls.push(["session", id]),
    unmarkStopped: (id) => calls.push(["unstop", id]),
    createTurn: () => turn,
    closeConfirmDialog: () => calls.push(["close"]),
    renderProviders: () => calls.push(["providers"]),
    renderWorkspace: (options) => calls.push(["workspace", options]),
    renderHistory: (options) => calls.push(["history", options]),
    startAcpSession: async () => calls.push(["acp"]),
    parseAgentBriefResponse: () => ({ "zh-CN": "中文职责", "en-US": "English brief" }),
    cloneAgentBriefs: () => briefs,
    writeBriefValue: (next, item, language, value, source) => {
      calls.push(["brief", language, value, source, item.id]);
      next[language] = value;
    },
    saveAgentBriefRecords: async (next) => calls.push(["save", { ...next }]),
    targetDisplayName: (item) => item.name,
    setAppNotice: (message, tone) => calls.push(["notice", message, tone]),
    t: (key, params = {}) => (params.target ? `${key}:${params.target}` : key),
    ...overrides,
  });
  return { controller, calls, target };
}

test("agentBriefController: 自动获取会创建会话并解析职责简报", async () => {
  const { controller, calls, target } = makeHarness();

  const result = await controller.fetchAgentBriefForTarget(target);

  assert.deepEqual(result, { "zh-CN": "中文职责", "en-US": "English brief" });
  assert.deepEqual(calls.slice(0, 5), [
    ["target", "agent-a"],
    ["session", "session-a"],
    ["unstop", "session-a"],
    ["close"],
    ["providers"],
  ]);
  assert.ok(calls.some((call) => call[0] === "acp"));
});

test("agentBriefController: 不可发送目标会被拦截", async () => {
  const { controller, target } = makeHarness({
    isTargetSendable: () => false,
  });

  await assert.rejects(
    () => controller.fetchAgentBriefForTarget(target),
    /agentBrief.targetUnavailable/,
  );
});

test("agentBriefController: refresh 保存中英文职责并显示通知", async () => {
  const { controller, calls, target } = makeHarness();

  await controller.refreshAgentBriefForTarget(target);

  assert.ok(calls.some((call) => call[0] === "brief" && call[1] === "zh-CN" && call[2] === "中文职责"));
  assert.ok(calls.some((call) => call[0] === "brief" && call[1] === "en-US" && call[2] === "English brief"));
  assert.ok(calls.some((call) => call[0] === "notice" && call[1] === "agentBrief.fetched:Agent A"));
});

test("agentBriefController: quiet refresh 不显示通知", async () => {
  const { controller, calls, target } = makeHarness();

  await controller.refreshAgentBriefForTarget(target, { quiet: true });

  assert.equal(calls.some((call) => call[0] === "notice"), false);
});
