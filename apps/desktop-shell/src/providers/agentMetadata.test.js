import test from "node:test";
import assert from "node:assert/strict";
import {
  providerStatusForFleet,
  targetStatusForFleet,
  isTargetUnavailableForFleet,
  agentBriefTargetKey,
  fallbackBriefKeyForTarget,
  explicitBriefText,
  briefRecordForTarget,
} from "./agentMetadata.js";

// Provider status tests

test("providerStatusForFleet: available provider returns is-available", () => {
  const provider = { id: "claude", name: "Claude Code" };
  const availability = { available: true, summary: "available" };
  const status = providerStatusForFleet(provider, availability);
  assert.equal(status.shape, "square");
  assert.equal(status.state, "available");
  assert.equal(status.className, "is-available");
  assert.equal(status.mutedCard, false);
});

test("providerStatusForFleet: partial provider returns is-partial", () => {
  const provider = { id: "hermes", name: "Hermes" };
  const availability = { available: true, summary: "partial" };
  const status = providerStatusForFleet(provider, availability);
  assert.equal(status.state, "partial");
  assert.equal(status.className, "is-partial");
  assert.equal(status.mutedCard, false);
});

test("providerStatusForFleet: not connected provider returns is-not-connected", () => {
  const provider = { id: "hermes", name: "Hermes" };
  const availability = { available: false, summary: "not_connected" };
  const status = providerStatusForFleet(provider, availability);
  assert.equal(status.state, "not_connected");
  assert.equal(status.className, "is-not-connected");
  assert.equal(status.mutedCard, false);
});

test("providerStatusForFleet: planned provider returns is-planned with muted card", () => {
  const provider = { id: "trae", name: "Trae" };
  const availability = { available: false, summary: "planned" };
  const status = providerStatusForFleet(provider, availability);
  assert.equal(status.state, "planned");
  assert.equal(status.className, "is-planned");
  assert.equal(status.mutedCard, true);
});

test("providerStatusForFleet: not configured provider returns is-not-configured with muted card", () => {
  const provider = { id: "custom", name: "Custom" };
  const availability = { available: false, summary: "not_configured" };
  const status = providerStatusForFleet(provider, availability);
  assert.equal(status.state, "not_configured");
  assert.equal(status.className, "is-not-configured");
  assert.equal(status.mutedCard, true);
});

// Target status tests

test("targetStatusForFleet: available runtime target returns circle is-available", () => {
  const target = {
    id: "claude-win",
    providerId: "claude",
    available: true,
    state: 1,
  };
  const status = targetStatusForFleet(target);
  assert.equal(status.shape, "circle");
  assert.equal(status.state, "available");
  assert.equal(status.className, "is-available");
});

test("targetStatusForFleet: stopped target returns circle is-unavailable", () => {
  const target = {
    id: "hermes-stopped",
    providerId: "hermes",
    available: false,
    state: 9,
    gateway: "stopped",
  };
  const status = targetStatusForFleet(target);
  assert.equal(status.shape, "circle");
  assert.equal(status.state, "unavailable");
  assert.equal(status.className, "is-unavailable");
});

test("targetStatusForFleet: running gateway returns is-available with gateway_running label", () => {
  const target = {
    id: "hermes-profile",
    providerId: "hermes",
    available: true,
    state: 1,
    gateway: "running",
  };
  const status = targetStatusForFleet(target);
  assert.equal(status.state, "available");
  assert.equal(status.labelKey, "availability.gatewayRunning");
});

test("targetStatusForFleet: stopped gateway returns is-unavailable with gateway_stopped label", () => {
  const target = {
    id: "hermes-profile",
    providerId: "hermes",
    available: false,
    state: 1,
    gateway: "stopped",
  };
  const status = targetStatusForFleet(target);
  assert.equal(status.state, "unavailable");
  assert.equal(status.labelKey, "availability.gatewayStopped");
});

// Target unavailable check

test("isTargetUnavailableForFleet: returns true for unavailable target", () => {
  const target = { available: false, state: 9 };
  assert.equal(isTargetUnavailableForFleet(target), true);
});

test("isTargetUnavailableForFleet: returns false for available target", () => {
  const target = { available: true, state: 1 };
  assert.equal(isTargetUnavailableForFleet(target), false);
});

// Brief key tests

test("agentBriefTargetKey: generates provider:host:identity key for complete target", () => {
  const target = {
    providerId: "claude",
    runtimeHost: "wsl",
    profileName: "default",
  };
  assert.equal(agentBriefTargetKey(target), "claude:wsl:default");
});

test("agentBriefTargetKey: falls back to id when parts missing", () => {
  const target = { id: "custom-agent" };
  // When provider/host/identity are missing, falls back to cleaned id with defaults
  assert.equal(agentBriefTargetKey(target), "agent:default:custom-agent");
});

test("agentBriefTargetKey: handles null target", () => {
  assert.equal(agentBriefTargetKey(null), "");
});

test("fallbackBriefKeyForTarget: claude provider returns codingRuntime", () => {
  const target = { providerId: "claude" };
  assert.equal(fallbackBriefKeyForTarget(target), "agentBrief.fallback.codingRuntime");
});

test("fallbackBriefKeyForTarget: hermes profile returns hermesProfile", () => {
  const target = { providerId: "hermes", kind: "profile" };
  assert.equal(fallbackBriefKeyForTarget(target), "agentBrief.fallback.hermesProfile");
});

test("fallbackBriefKeyForTarget: dynamic adapter returns manifestRuntime", () => {
  const target = { dynamicAdapter: true, runtimeCommand: null };
  assert.equal(fallbackBriefKeyForTarget(target), "agentBrief.fallback.manifestRuntime");
});

test("fallbackBriefKeyForTarget: generic profile returns agentProfile", () => {
  const target = { kind: "profile" };
  assert.equal(fallbackBriefKeyForTarget(target), "agentBrief.fallback.agentProfile");
});

test("fallbackBriefKeyForTarget: default returns agentProfile", () => {
  const target = {};
  assert.equal(fallbackBriefKeyForTarget(target), "agentBrief.fallback.agentProfile");
});

// Explicit brief text

test("explicitBriefText: extracts brief from various fields", () => {
  assert.equal(explicitBriefText({ brief: "Test brief" }), "Test brief");
  assert.equal(explicitBriefText({ description: "Test desc" }), "Test desc");
  assert.equal(explicitBriefText({ summary: "Test summary" }), "Test summary");
  assert.equal(explicitBriefText({ role: "Test role" }), "Test role");
  assert.equal(explicitBriefText({ purpose: "Test purpose" }), "Test purpose");
});

test("explicitBriefText: returns empty when no fields present", () => {
  assert.equal(explicitBriefText({}), "");
  assert.equal(explicitBriefText(null), "");
});

// Brief record lookup

test("briefRecordForTarget: finds localized record by key", () => {
  const agentBriefs = {
    "claude:wsl:default": {
      "zh-CN": { text: "代码助手", source: "manual" },
      "en-US": { text: "Coding assistant", source: "manual" },
    },
  };
  const target = {
    providerId: "claude",
    runtimeHost: "wsl",
    profileName: "default",
  };
  const record = briefRecordForTarget(agentBriefs, target, "zh-CN");
  assert.equal(record.text, "代码助手");
  assert.equal(record.source, "manual");
});

test("briefRecordForTarget: returns null when key missing", () => {
  const agentBriefs = {};
  const target = { providerId: "unknown" };
  assert.equal(briefRecordForTarget(agentBriefs, target, "zh-CN"), null);
});

test("briefRecordForTarget: returns null when language missing", () => {
  const agentBriefs = {
    "claude:wsl:default": {
      "en-US": { text: "English only", source: "manual" },
    },
  };
  const target = {
    providerId: "claude",
    runtimeHost: "wsl",
    profileName: "default",
  };
  assert.equal(briefRecordForTarget(agentBriefs, target, "zh-CN"), null);
});
