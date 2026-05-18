#!/usr/bin/env node
/**
 * LunaAgentOS ACP Spike
 *
 * Goal: verify we can drive Claude through the Agent Client Protocol.
 *   1. Spawn `@agentclientprotocol/claude-agent-acp` over stdio (ndjson JSON-RPC).
 *   2. Send `initialize` and `session/new`.
 *   3. Send a `session/prompt`, observe `session/update` notifications and the
 *      final stopReason. Optionally run a second turn to verify session memory.
 *   4. Log structured events that map cleanly to LunaAgentOS RuntimeEvent.
 *
 * This script does NOT touch any LunaAgentOS UI. It is a pure backend probe.
 *
 * Usage:
 *   npm install
 *   node acp-spike.mjs "what is your name?"
 *
 * Optional env:
 *   ACP_AGENT_BIN     override the agent binary, defaults to `npx -y @agentclientprotocol/claude-agent-acp`
 *   ACP_SECOND_TURN   if set, send a second prompt to verify session continuity
 */

import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as acp from "@agentclientprotocol/sdk";

/**
 * Load env vars from `~/.claude/settings.json`'s `env` section if present.
 * `claude-agent-acp`'s `resolveSettings({ settingSources: [] })` intentionally
 * skips the user settings file, so for the spike we forward the same env that
 * the local `claude` CLI uses. Returns plain string values only.
 */
function loadClaudeUserEnv() {
  try {
    const p = join(homedir(), ".claude", "settings.json");
    const raw = JSON.parse(readFileSync(p, "utf8"));
    const out = {};
    for (const [k, v] of Object.entries(raw?.env ?? {})) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = String(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

const CLAUDE_USER_ENV = loadClaudeUserEnv();

const userPrompt = process.argv.slice(2).join(" ").trim() || "Say hello in one short sentence.";

function log(label, payload) {
  if (payload === undefined) {
    console.log(`[spike] ${label}`);
  } else {
    console.log(`[spike] ${label}: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  }
}

class SpikeClient {
  // ACP Client surface. claude-agent-acp will call into these.
  async sessionUpdate(params) {
    const u = params.update;
    switch (u.sessionUpdate) {
      case "agent_message_chunk":
        if (u.content?.type === "text") {
          process.stdout.write(u.content.text);
        } else {
          log("agent_message_chunk", { type: u.content?.type });
        }
        break;
      case "agent_thought_chunk":
        log("thought", u.content?.text ?? u.content?.type);
        break;
      case "plan":
        log("plan.entries", u.entries?.map((e) => e.content));
        break;
      case "tool_call":
        log("tool_call.start", { id: u.toolCallId, title: u.title, kind: u.kind, status: u.status });
        break;
      case "tool_call_update":
        log("tool_call.update", { id: u.toolCallId, status: u.status });
        break;
      case "user_message_chunk":
        log("user_message_chunk", u.content?.text ?? u.content?.type);
        break;
      default:
        log("session_update.other", u.sessionUpdate);
    }
  }

  async requestPermission(params) {
    log("permission.request", {
      tool: params.toolCall?.title,
      options: params.options?.map((o) => ({ id: o.optionId, name: o.name, kind: o.kind })),
    });
    // For the spike: auto-accept the first allow-style option, or fall back to the first option.
    const opt =
      params.options?.find((o) => o.kind === "allow_once" || o.kind === "allow_always") ??
      params.options?.[0];
    if (!opt) {
      return { outcome: { outcome: "cancelled" } };
    }
    log("permission.auto_select", { id: opt.optionId, kind: opt.kind });
    return { outcome: { outcome: "selected", optionId: opt.optionId } };
  }

  async writeTextFile(params) {
    log("client.writeTextFile", { path: params.path, bytes: params.content?.length ?? 0 });
    return {};
  }

  async readTextFile(params) {
    log("client.readTextFile", { path: params.path });
    return { content: "" };
  }
}

function spawnAgent() {
  // Node 24+ on Windows refuses to spawn .cmd / .bat without shell:true for
  // security reasons (see CVE-2024-27980). We need shell:true on Windows.
  const useShell = process.platform === "win32";
  const childEnv = { ...process.env, ...CLAUDE_USER_ENV };
  if (Object.keys(CLAUDE_USER_ENV).length > 0) {
    log("forwarding user claude env keys", Object.keys(CLAUDE_USER_ENV));
  }
  const override = process.env.ACP_AGENT_BIN;
  if (override) {
    log("spawning override", override);
    const parts = override.split(/\s+/);
    return spawn(parts[0], parts.slice(1), {
      stdio: ["pipe", "pipe", "inherit"],
      shell: useShell,
      env: childEnv,
    });
  }
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  log("spawning", `${npxCmd} -y @agentclientprotocol/claude-agent-acp`);
  return spawn(npxCmd, ["-y", "@agentclientprotocol/claude-agent-acp"], {
    stdio: ["pipe", "pipe", "inherit"],
    shell: useShell,
    env: childEnv,
  });
}

async function main() {
  const agentProcess = spawnAgent();

  agentProcess.on("error", (err) => {
    console.error("[spike] agent process error:", err);
  });

  const input = Writable.toWeb(agentProcess.stdin);
  const output = Readable.toWeb(agentProcess.stdout);

  const client = new SpikeClient();
  const stream = acp.ndJsonStream(input, output);
  const connection = new acp.ClientSideConnection(() => client, stream);

  try {
    const init = await connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
      clientInfo: {
        name: "lunaagentos-spike",
        title: "LunaAgentOS Spike",
        version: "0.0.1",
      },
    });
    log("initialized", {
      protocolVersion: init.protocolVersion,
      agent: init.agentInfo,
      caps: init.agentCapabilities,
      authMethods: init.authMethods,
    });

    const session = await connection.newSession({
      cwd: process.cwd(),
      mcpServers: [],
    });
    log("session.new", { sessionId: session.sessionId });

    log("turn1.user", userPrompt);
    process.stdout.write("[spike] turn1.agent_text> ");
    const turn1 = await connection.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: userPrompt }],
    });
    process.stdout.write("\n");
    log("turn1.stopReason", turn1.stopReason);

    if (process.env.ACP_SECOND_TURN) {
      const followup = "Repeat back the very last sentence you just said, verbatim.";
      log("turn2.user", followup);
      process.stdout.write("[spike] turn2.agent_text> ");
      const turn2 = await connection.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: followup }],
      });
      process.stdout.write("\n");
      log("turn2.stopReason", turn2.stopReason);
    }

    log("done");
  } catch (err) {
    console.error("[spike] error:", err);
    process.exitCode = 1;
  } finally {
    try {
      agentProcess.stdin?.end();
    } catch {}
    agentProcess.kill();
  }
}

main();
