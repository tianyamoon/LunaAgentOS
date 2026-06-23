import test from "node:test";
import assert from "node:assert/strict";

import { runStartupTasks, scheduleStartupTasks } from "./startupTaskScheduler.js";

test("startupTaskScheduler: waits for two frames before starting work", async () => {
  const frames = [];
  const calls = [];
  scheduleStartupTasks([() => calls.push("task")], {
    requestFrame: (callback) => frames.push(callback),
    setTimer: (callback) => callback(),
  });

  assert.deepEqual(calls, []);
  frames.shift()();
  assert.deepEqual(calls, []);
  frames.shift()();
  await Promise.resolve();
  assert.deepEqual(calls, ["task"]);
});

test("startupTaskScheduler: runs tasks sequentially and continues after a failure", async () => {
  const calls = [];
  const errors = [];
  await runStartupTasks([
    async () => calls.push("first"),
    async () => { throw new Error("boom"); },
    async () => calls.push("third"),
  ], {
    setTimer: (callback) => callback(),
    delayMs: 0,
    onError: (error) => errors.push(error.message),
  });

  assert.deepEqual(calls, ["first", "third"]);
  assert.deepEqual(errors, ["boom"]);
});
