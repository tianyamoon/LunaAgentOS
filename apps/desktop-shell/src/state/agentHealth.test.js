import test from "node:test";
import assert from "node:assert/strict";

import {
  HEALTH_STATE,
  HEALTH_FIELDS,
  deriveOverallHealth,
  deriveProviderHealth,
  deriveRuntimeHealth,
  deriveTargetHealth,
} from "./agentHealth.js";

test("explicit unknown runtime facts are not promoted by heuristics", () => {
  const health = deriveTargetHealth({
    health: { installed: "unknown", cliCallable: "unknown", modelOrKeyConfigured: "unknown" },
    healthEvidence: [{ field: "cli_callable", source: "probe", detail: "not verified" }],
  }, { sendable: true });
  assert.equal(health.installed, "unknown");
  assert.equal(health.cli_callable, "unknown");
  assert.equal(health.model_or_key_configured, "unknown");
  assert.equal(health.evidence[0].source, "probe");
});

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

test("deriveProviderHealth: one available runtime keeps provider available despite failed siblings", () => {
  const health = deriveProviderHealth(
    {},
    { configured: true, available: true },
    [{ available: true }, { available: false, commandKind: "wsl" }],
  );

  assert.equal(health.cli_callable, HEALTH_STATE.ok);
  assert.equal(health.wsl_or_bridge_available, HEALTH_STATE.not_applicable);
  assert.equal(health.unavailable_reason, null);
  assert.notEqual(health.overall, "unavailable");
});

test("deriveTargetHealth: non-profile target marks profile/bridge as not applicable, not unknown", () => {
  const health = deriveTargetHealth({}, { sendable: true });

  assert.equal(health.profile_configured, HEALTH_STATE.not_applicable);
  assert.equal(health.wsl_or_bridge_available, HEALTH_STATE.not_applicable);
  // not_applicable 字段本身不应被计入 unknown 判定。
  assert.ok(![health.profile_configured, health.wsl_or_bridge_available].includes(HEALTH_STATE.unknown));
});

test("deriveOverallHealth: not_applicable fields are inert and do not produce unknown", () => {
  // 所有字段 ok，仅 profile/bridge 为 not_applicable —— 总体应为 available 而非 unknown。
  const health = Object.fromEntries(HEALTH_FIELDS.map((field) => [field, HEALTH_STATE.ok]));
  health.profile_configured = HEALTH_STATE.not_applicable;
  health.wsl_or_bridge_available = HEALTH_STATE.not_applicable;

  assert.equal(deriveOverallHealth(health), "available");

  // 仍存在真实 unknown 时，总体应如实退化为 unknown。
  health.logged_in = HEALTH_STATE.unknown;
  assert.equal(deriveOverallHealth(health), "unknown");
});

test("deriveTargetHealth: install state is unknown at target layer (no probe), not a fake ok", () => {
  const health = deriveTargetHealth({}, { sendable: true });
  // Target 层不运行安装探测，installed 不可确认，应为 unknown 而非伪装 ok。
  assert.equal(health.installed, HEALTH_STATE.unknown);
  assert.equal(health.overall, "unknown");
});

test("deriveOverallHealth: no genuinely-verified field never reports available", () => {
  // 全部 not_applicable、无任何 ok、无 unavailable_reason —— 不得声称 available。
  const allNa = Object.fromEntries(HEALTH_FIELDS.map((field) => [field, HEALTH_STATE.not_applicable]));
  assert.equal(deriveOverallHealth(allNa), "unknown");

  // 至少一项 ok（其余 not_applicable）才允许 available。
  const oneOk = { ...allNa, cli_callable: HEALTH_STATE.ok };
  assert.equal(deriveOverallHealth(oneOk), "available");
});

test("deriveRuntimeHealth: native runtime treats bridge availability as not applicable", () => {
  const health = deriveRuntimeHealth({
    configured: true,
    available: true,
    commandKind: "native",
  });

  assert.equal(health.wsl_or_bridge_available, HEALTH_STATE.not_applicable);
  assert.equal(health.profile_configured, HEALTH_STATE.not_applicable);
});
