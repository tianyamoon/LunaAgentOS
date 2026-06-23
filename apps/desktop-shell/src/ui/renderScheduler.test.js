import test from "node:test";
import assert from "node:assert/strict";
import { createRenderScheduler } from "./renderScheduler.js";

function createFrameHarness() {
  const frames = [];
  const timers = [];
  return {
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    setTimeout(callback, delayMs) {
      timers.push({ callback, delayMs });
      return timers.length;
    },
    flushFrame() {
      frames.shift()?.();
    },
    flushTimer() {
      timers.shift()?.callback();
    },
    frames,
    timers,
  };
}

test("renderScheduler: merges options until the scheduled frame renders", () => {
  const harness = createFrameHarness();
  const rendered = [];
  const scheduler = createRenderScheduler({
    render: (options) => rendered.push(options),
    requestAnimationFrame: harness.requestAnimationFrame,
  });
  scheduler.schedule({ scrollSessionId: "a" });
  scheduler.schedule({ focusSessionId: "b" });
  assert.equal(harness.frames.length, 1);
  assert.equal(scheduler.hasPending(), true);

  harness.flushFrame();
  assert.deepEqual(rendered, [{ scrollSessionId: "a", focusSessionId: "b" }]);
  assert.equal(scheduler.hasPending(), false);
});

test("renderScheduler: delayed render waits for timer before scheduling a frame", () => {
  const harness = createFrameHarness();
  const rendered = [];
  const scheduler = createRenderScheduler({
    render: (options) => rendered.push(options),
    requestAnimationFrame: harness.requestAnimationFrame,
    setTimeout: harness.setTimeout,
  });
  scheduler.schedule({ id: "slow" }, 50);
  scheduler.schedule({ merged: true });
  assert.equal(harness.timers.length, 1);
  assert.equal(harness.timers[0].delayMs, 50);
  assert.equal(harness.frames.length, 0);

  harness.flushTimer();
  assert.equal(harness.frames.length, 1);
  harness.flushFrame();
  assert.deepEqual(rendered, [{ id: "slow", merged: true }]);
});

test("renderScheduler: default render callback is optional", () => {
  const harness = createFrameHarness();
  const scheduler = createRenderScheduler({
    requestAnimationFrame: harness.requestAnimationFrame,
  });
  scheduler.schedule();
  assert.doesNotThrow(() => harness.flushFrame());
});

test("renderScheduler: pending options can be adjusted before frame flush", () => {
  const harness = createFrameHarness();
  const rendered = [];
  const scheduler = createRenderScheduler({
    render: (options) => rendered.push(options),
    requestAnimationFrame: harness.requestAnimationFrame,
  });
  scheduler.schedule({ focusSessionId: "removed", scrollSessionId: "kept" });
  scheduler.updatePendingOptions((options) => ({ ...options, focusSessionId: null }));
  harness.flushFrame();
  assert.deepEqual(rendered, [{ focusSessionId: null, scrollSessionId: "kept" }]);
});
