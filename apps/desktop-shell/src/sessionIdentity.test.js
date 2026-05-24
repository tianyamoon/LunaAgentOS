import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSessionIdentity } from "./sessionIdentity.js";

const providers = [
  { id: "claude", name: "Claude Code" },
  { id: "hermes", name: "Hermes" },
  { id: "codex", name: "OpenAI Codex" },
];

const runtimeInstances = [
  {
    id: "hermes-win",
    providerId: "hermes",
    runtimeLabel: "Win",
    commandKind: "native",
    command: "hermes.exe",
  },
  {
    id: "hermes-wsl",
    providerId: "hermes",
    runtimeLabel: "WSL",
    commandKind: "wsl",
    command: "hermes",
  },
  {
    id: "claude-win",
    providerId: "claude",
    runtimeLabel: "Win",
    commandKind: "native",
    command: "npx.cmd",
  },
  {
    id: "claude-wsl",
    providerId: "claude",
    runtimeLabel: "WSL",
    commandKind: "wsl",
    command: "npx",
  },
  {
    id: "codex-manifest",
    providerId: "codex",
    runtimeLabel: "Manifest",
    commandKind: "manifest",
    command: "npx -y @openai/codex",
  },
];

const runtimeTargets = [
  {
    id: "hermes-wsl:profile:default",
    providerId: "hermes",
    runtimeInstanceId: "hermes-wsl",
    runtimeLabel: "WSL",
    runtimeHost: "wsl",
    runtimeCommand: "hermes",
    kind: "profile",
    name: "default",
    profileName: "default",
    profileAlias: null,
    profileExecutable: null,
    model: "qwen3.6-plus",
    gateway: "running",
    skillCount: 121,
    hasSoul: true,
  },
  {
    id: "hermes-wsl:profile:xx",
    providerId: "hermes",
    runtimeInstanceId: "hermes-wsl",
    runtimeLabel: "WSL",
    runtimeHost: "wsl",
    runtimeCommand: "hermes",
    kind: "profile",
    name: "xx",
    profileName: "xx",
    profileAlias: "xx",
    profileExecutable: "xx",
    model: "qwen3.6-plus",
    gateway: "running",
  },
];

test("normalizes legacy WSL Hermes default session without using current send target", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-legacy-hermes-default",
      providerId: "hermes",
      providerName: "XX",
      agentId: "hermes-profile-default",
      agentName: "XX / default",
      targetId: null,
      runtimeInstanceId: null,
      runtimeLabel: null,
      turns: [],
    },
    { providers, runtimeInstances, runtimeTargets },
  );

  assert.equal(normalized.providerName, "Hermes");
  assert.equal(normalized.agentId, "hermes-wsl:profile:default");
  assert.equal(normalized.targetId, "hermes-wsl:profile:default");
  assert.equal(normalized.runtimeInstanceId, "hermes-wsl");
  assert.equal(normalized.runtimeHost, "wsl");
  assert.equal(normalized.runtimeCommand, "hermes");
  assert.equal(normalized.agentName, "Hermes · WSL / default");
  assert.equal(normalized.profileName, "default");
  assert.equal(normalized.profileModel, "qwen3.6-plus");
  assert.equal(normalized.profileExecutable, null);
});

test("preserves Hermes WSL profile model metadata from turn history when no live target exists", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-legacy-hermes-main",
      providerId: "hermes",
      providerName: "Hermes",
      agentId: "hermes-main",
      agentName: "Hermes / 主会话",
      runtimeInstanceId: null,
      turns: [
        {
          id: "turn-1",
          meta: {
            hermesProfile: {
              profileName: "default",
              profileModel: "qwen3.6-plus",
              gateway: "running",
              skillCount: 121,
              hasSoul: true,
            },
          },
        },
      ],
    },
    { providers, runtimeInstances, runtimeTargets: [] },
  );

  assert.equal(normalized.runtimeInstanceId, "hermes-wsl");
  assert.equal(normalized.agentName, "Hermes · WSL / default");
  assert.equal(normalized.profileModel, "qwen3.6-plus");
  assert.equal(normalized.skillCount, 121);
});

test("keeps Claude WSL card identity independent from selected Claude Win target", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-claude-wsl",
      providerId: "claude",
      providerName: "Claude Code",
      agentId: "claude-wsl",
      agentName: "Claude Code · Win",
      runtimeInstanceId: "claude-wsl",
      runtimeLabel: null,
      turns: [],
    },
    { providers, runtimeInstances, runtimeTargets },
  );

  assert.equal(normalized.runtimeInstanceId, "claude-wsl");
  assert.equal(normalized.runtimeHost, "wsl");
  assert.equal(normalized.agentName, "Claude Code · WSL");
});

test("hides Hermes profile path from card title while preserving it for identity", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-hermes-path-alias",
      providerId: "hermes",
      providerName: "Hermes",
      agentId: "hermes-wsl:profile:ailearing",
      targetId: "hermes-wsl:profile:ailearing",
      agentName: "Hermes · WSL / /root/.local/bin/ailearing",
      runtimeInstanceId: "hermes-wsl",
      runtimeLabel: "WSL",
      profileAlias: "/root/.local/bin/ailearing",
      profileExecutable: "/root/.local/bin/ailearing",
      profilePath: "/root/hermes-agent/profiles/ailearing",
      turns: [],
    },
    { providers, runtimeInstances, runtimeTargets: [] },
  );

  assert.equal(normalized.agentName, "Hermes · WSL / ailearing");
  assert.equal(normalized.profileAlias, "/root/.local/bin/ailearing");
  assert.equal(normalized.profileExecutable, "/root/.local/bin/ailearing");
  assert.equal(normalized.profilePath, "/root/hermes-agent/profiles/ailearing");
});

test("keeps Claude Win runtime visible in session title", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-claude-win",
      providerId: "claude",
      providerName: "Claude Code",
      agentId: "claude-win",
      agentName: "Claude Code",
      runtimeInstanceId: "claude-win",
      runtimeLabel: null,
      turns: [],
    },
    { providers, runtimeInstances, runtimeTargets },
  );

  assert.equal(normalized.runtimeInstanceId, "claude-win");
  assert.equal(normalized.runtimeHost, "native");
  assert.equal(normalized.agentName, "Claude Code · Win");
});

test("uses manifest runtime defaults for dynamic providers without command override", () => {
  const normalized = normalizeSessionIdentity(
    {
      id: "session-codex",
      providerId: "codex",
      providerName: "Codex",
      agentId: "codex-main",
      agentName: "Codex",
      runtimeInstanceId: null,
      runtimeLabel: null,
      turns: [],
    },
    { providers, runtimeInstances, runtimeTargets },
  );

  assert.equal(normalized.providerName, "OpenAI Codex");
  assert.equal(normalized.runtimeInstanceId, "codex-manifest");
  assert.equal(normalized.runtimeHost, "manifest");
  assert.equal(normalized.runtimeCommand, null);
});
