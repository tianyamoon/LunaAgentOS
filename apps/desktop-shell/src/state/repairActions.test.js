import test from "node:test";
import assert from "node:assert/strict";

import { buildRepairActions, REPAIR_ACTION_TYPE } from "./repairActions.js";

test("run_agent_login on claude native: copy login command then reprobe", () => {
  const actions = buildRepairActions(
    { repair_hint: "run_agent_login" },
    { providerId: "claude", instance: { commandKind: "native" } },
  );
  assert.equal(actions.length, 2);
  assert.equal(actions[0].type, REPAIR_ACTION_TYPE.copy_command);
  assert.equal(actions[0].command, "claude auth login");
  assert.equal(actions[1].type, REPAIR_ACTION_TYPE.reprobe);
  assert.equal(actions[1].providerId, "claude");
});

test("run_agent_login on claude wsl: command is prefixed with wsl", () => {
  const actions = buildRepairActions(
    { repair_hint: "run_agent_login" },
    { providerId: "claude", instance: { commandKind: "wsl" } },
  );
  assert.equal(actions[0].command, "wsl claude auth login");
});

test("unknown provider drops copy_command, keeps reprobe", () => {
  const actions = buildRepairActions(
    { repair_hint: "run_agent_login" },
    { providerId: "some-dynamic-adapter", instance: {} },
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, REPAIR_ACTION_TYPE.reprobe);
});

test("check_runtime_command routes to provider dialog plus reprobe", () => {
  const actions = buildRepairActions(
    { repair_hint: "check_runtime_command" },
    { providerId: "claude" },
  );
  assert.equal(actions[0].type, REPAIR_ACTION_TYPE.open_dialog);
  assert.equal(actions[0].dialog, "provider");
  assert.equal(actions[0].providerId, "claude");
  assert.equal(actions[1].type, REPAIR_ACTION_TYPE.reprobe);
});

test("configure_provider only opens the dialog", () => {
  const actions = buildRepairActions({ repair_hint: "configure_provider" }, { providerId: "hermes" });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, REPAIR_ACTION_TYPE.open_dialog);
});

test("check_runtime_login copies the status command", () => {
  const actions = buildRepairActions(
    { repair_hint: "check_runtime_login" },
    { providerId: "claude", instance: { commandKind: "native" } },
  );
  assert.equal(actions[0].command, "claude auth status");
});

test("send_to_connect yields no actions (passive text only)", () => {
  assert.deepEqual(buildRepairActions({ repair_hint: "send_to_connect" }, { providerId: "claude" }), []);
});

test("missing or unknown repair_hint yields no actions", () => {
  assert.deepEqual(buildRepairActions({}, { providerId: "claude" }), []);
  assert.deepEqual(buildRepairActions({ repair_hint: "totally_unknown" }, { providerId: "claude" }), []);
});
