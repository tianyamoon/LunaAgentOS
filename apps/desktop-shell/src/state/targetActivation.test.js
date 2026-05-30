import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTargetStartSession,
  isStoppedHermesTarget,
  isTargetActivatable,
  isTargetSelectable,
  isTargetSendable,
} from "./targetActivation.js";

test("running targets are sendable and selectable", () => {
  const target = { providerId: "hermes", gateway: "running", available: true };

  assert.equal(isStoppedHermesTarget(target), false);
  assert.equal(isTargetSendable(target), true);
  assert.equal(isTargetActivatable(target), false);
  assert.equal(isTargetSelectable(target), true);
  assert.equal(canTargetStartSession(target), true);
});

test("stopped Hermes profiles are activatable but not sendable", () => {
  const target = {
    providerId: "hermes",
    kind: "profile",
    gateway: "stopped",
    available: false,
    profileExecutable: "xx",
  };

  assert.equal(isStoppedHermesTarget(target), true);
  assert.equal(isTargetSendable(target), false);
  assert.equal(isTargetActivatable(target), true);
  assert.equal(isTargetSelectable(target), true);
  assert.equal(canTargetStartSession(target), true);
});

test("unconfigured stopped Hermes profiles remain blocked", () => {
  const target = {
    providerId: "hermes",
    kind: "profile",
    gateway: "stopped",
    available: false,
    profileName: "worker",
  };

  assert.equal(isStoppedHermesTarget(target), true);
  assert.equal(isTargetSendable(target), false);
  assert.equal(isTargetActivatable(target), false);
  assert.equal(isTargetSelectable(target), false);
  assert.equal(canTargetStartSession(target), false);
});

test("stopped default Hermes profile is activatable through the runtime command", () => {
  const target = {
    providerId: "hermes",
    kind: "profile",
    gateway: "stopped",
    available: false,
    profileName: "default",
  };

  assert.equal(isTargetSendable(target), false);
  assert.equal(isTargetActivatable(target), true);
  assert.equal(canTargetStartSession(target), true);
});

test("unavailable non-Hermes targets are neither selectable nor startable", () => {
  const target = { providerId: "claude", available: false };

  assert.equal(isTargetSendable(target), false);
  assert.equal(isTargetActivatable(target), false);
  assert.equal(isTargetSelectable(target), false);
  assert.equal(canTargetStartSession(target), false);
});
