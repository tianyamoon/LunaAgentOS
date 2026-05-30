import test from "node:test";
import assert from "node:assert/strict";

import {
  HEALTH_STATE,
  deriveProviderHealth,
  deriveRuntimeHealth,
  deriveTargetHealth,
} from "./agentHealth.js";

test("deriveRuntimeHealth: unavailable configured runtime explains CLI failure", () => {
  const health = deriveRuntimeHealth({
    configured: true,
    available: false,
    commandKind: "native",
    detail: "command not found",
  });

  assert.equal(health.installed, HEALTH_STATE.unknown);
  assert.equal(health.cli_callable, HEALTH_STATE.failed);
  assert.equal(health.unavailable_reason, "cli_not_callable");
  assert.equal(health.repair_hint, "check_runtime_command");
});

test("deriveRuntimeHealth: bridge-like runtime marks bridge availability separately", () => {
  const health = deriveRuntimeHealth({
    configured: true,
    available: false,
    commandKind: "wsl",
    detail: "wsl command failed",
  });

  assert.equal(health.wsl_or_bridge_available, HEALTH_STATE.failed);
  assert.equal(health.overall, "unavailable");
});

test("deriveTargetHealth: connectable target is not sendable but has a concrete reason", () => {
  const health = deriveTargetHealth(
    {
      kind: "profile",
      profileName: "default",
      profileExecutable: "agent-profile",
      available: false,
    },
    { sendable: false, activatable: true },
  );

  assert.equal(health.profile_configured, HEALTH_STATE.ok);
  assert.equal(health.cli_callable, HEALTH_STATE.ok);
  assert.equal(health.unavailable_reason, "runtime_stopped");
  assert.equal(health.repair_hint, "send_to_connect");
  assert.equal(health.overall, "connectable");
});

test("deriveTargetHealth: profile without identity reports profile configuration missing", () => {
  const health = deriveTargetHealth(
    { kind: "profile", available: false },
    { sendable: false, activatable: false },
  );

  assert.equal(health.profile_configured, HEALTH_STATE.missing);
  assert.equal(health.unavailable_reason, "profile_not_configured");
  assert.equal(health.repair_hint, "configure_profile");
});

test("deriveProviderHealth: explicit adapter health fields override shell inference", () => {
  const health = deriveProviderHealth(
    {
      id: "custom",
      health: {
        logged_in: "required",
        unavailable_reason: "auth_required",
        repair_hint: "run_agent_login",
      },
    },
    { configured: true, available: false },
    [],
  );

  assert.equal(health.logged_in, HEALTH_STATE.required);
  assert.equal(health.unavailable_reason, "auth_required");
  assert.equal(health.repair_hint, "run_agent_login");
});
