import test from "node:test";
import assert from "node:assert/strict";
import { acpCommandsForProvider } from "./acpCommands.js";

test("acpCommandsForProvider: manifest-backed providers use generic adapter commands", () => {
  for (const id of ["claude", "hermes", "codex"]) {
    const commands = acpCommandsForProvider({ id, dynamicAdapter: true });
    assert.equal(commands.prompt, "runtime_acp_adapter_prompt");
    assert.equal(commands.load, "runtime_acp_adapter_load");
    assert.equal(commands.resume, "runtime_acp_adapter_resume");
    assert.equal(commands.shutdown, "runtime_acp_adapter_shutdown");
    assert.equal(commands.aliveIds, "runtime_acp_adapter_alive_ids");
    assert.equal(commands.requiresAdapterId, true);
  }
});

test("acpCommandsForProvider: non-manifest providers have no ACP command routing", () => {
  assert.equal(acpCommandsForProvider({ id: "claude" }), null);
  assert.equal(acpCommandsForProvider({ id: "hermes", dynamicAdapter: false }), null);
  assert.equal(acpCommandsForProvider(null), null);
});
