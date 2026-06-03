import test from "node:test";
import assert from "node:assert/strict";
import {
  providerAvailabilityLabel,
  providerAvailabilityState,
  runtimeStateClasses,
  runtimeStateLabel,
  stateClasses,
  stateDisplayLabel,
  stateName,
} from "./runtimeStatePresentation.js";

test("runtimeStatePresentation: maps numeric runtime state to names and classes", () => {
  assert.equal(stateName(5), "DONE");
  assert.equal(stateName(99), "UNKNOWN");
  assert.equal(stateClasses[2], "state-think");
  assert.equal(stateDisplayLabel(3), "Using tools");
  assert.equal(stateDisplayLabel(3, (key) => `t:${key}`), "t:state.tooling");
});

test("runtimeStatePresentation: maps runtime lifecycle labels", () => {
  assert.equal(runtimeStateClasses.resume_failed, "runtime-failed");
  assert.equal(runtimeStateLabel("restoring"), "Reconnecting");
  assert.equal(runtimeStateLabel("restoring", (key) => `t:${key}`), "t:runtime.restoring");
  assert.equal(runtimeStateLabel("custom"), "custom");
});

test("runtimeStatePresentation: maps provider availability summaries", () => {
  assert.equal(providerAvailabilityState("partial"), 2);
  assert.equal(providerAvailabilityState("not_connected"), 9);
  assert.equal(providerAvailabilityState("unknown"), undefined);
  assert.equal(providerAvailabilityLabel("planned", (key) => `t:${key}`), "t:provider.planned");
  assert.equal(providerAvailabilityLabel("unknown", (key) => `t:${key}`), "unknown");
});
