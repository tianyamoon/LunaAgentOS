import test from "node:test";
import assert from "node:assert/strict";
import { createAcpRuntimeClient } from "./acpRuntimeClient.js";

const commands = {
  prompt: "prompt",
  load: "load",
  resume: "resume",
  shutdown: "shutdown",
  aliveIds: "alive_ids",
  requiresAdapterId: true,
};

function makeClient({ responses = {}, probeDelaysMs = [1, 2], commandsForProvider } = {}) {
  const calls = [];
  const waits = [];
  const client = createAcpRuntimeClient({
    invoke: async (command, args) => {
      calls.push({ command, args });
      const response = responses[command];
      if (response instanceof Error) throw response;
      return typeof response === "function" ? response(calls.length) : response;
    },
    commandsForProvider: commandsForProvider || (() => commands),
    translate: (key) => `translated:${key}`,
    wait: async (delayMs) => waits.push(delayMs),
    probeDelaysMs,
  });
  return { calls, client, waits };
}

function makeSession() {
  return {
    id: "runtime-1",
    providerId: "hermes",
    acpSessionId: "acp-1",
    runtimeHost: "wsl",
    runtimeCommand: "agent",
    profileExecutable: "default",
  };
}

test("acpRuntimeClient: prompt builds generic adapter args", async () => {
  const { calls, client } = makeClient({ responses: { prompt: ["done"] } });
  const result = await client.prompt(makeSession(), { id: "turn-1", task: "fallback", runtimePrompt: "actual" }, "run-1");
  assert.deepEqual(result, ["done"]);
  assert.deepEqual(calls[0], {
    command: "prompt",
    args: {
      adapterId: "hermes",
      runtimeSessionId: "runtime-1",
      cwd: null,
      runtimeHost: "wsl",
      runtimeCommand: "agent",
      profileExecutable: "default",
      prompt: "actual",
      turnId: "turn-1",
      promptRunId: "run-1",
    },
  });
});

test("acpRuntimeClient: load, resume and shutdown use session identity", async () => {
  const { calls, client } = makeClient();
  const session = makeSession();
  await client.load(session);
  await client.resume(session);
  await client.shutdown(session);
  assert.equal(calls[0].command, "load");
  assert.equal(calls[0].args.acpSessionId, "acp-1");
  assert.equal(calls[1].command, "resume");
  assert.equal(calls[1].args.acpSessionId, "acp-1");
  assert.deepEqual(calls[2], {
    command: "shutdown",
    args: { adapterId: "hermes", runtimeSessionId: "runtime-1" },
  });
});

test("acpRuntimeClient: verifyAlive probes every delay", async () => {
  const { calls, client, waits } = makeClient({ responses: { alive_ids: ["runtime-1"] } });
  await client.verifyAlive("hermes", "runtime-1");
  assert.deepEqual(waits, [1, 2]);
  assert.equal(calls.length, 2);
});

test("acpRuntimeClient: verifyAlive reports missing or failed child", async () => {
  const missing = makeClient({ responses: { alive_ids: [] } }).client;
  await assert.rejects(() => missing.verifyAlive("hermes", "runtime-1"), /translated:restore.aliveCheckFailed/);
  const failed = makeClient({ responses: { alive_ids: new Error("boom") } }).client;
  await assert.rejects(() => failed.verifyAlive("hermes", "runtime-1"), /translated:restore.aliveCheckFailed/);
});

test("acpRuntimeClient: unsupported providers stay inert", async () => {
  const { calls, client } = makeClient({ commandsForProvider: () => null });
  assert.equal(client.canHandle("trae"), false);
  assert.equal(await client.shutdown(makeSession()), false);
  assert.equal(await client.prompt(makeSession(), { id: "turn-1", task: "x" }, "run-1"), null);
  assert.equal(await client.aliveIds("trae"), null);
  assert.deepEqual(calls, []);
});
