// Launch demo scene: a fixed snapshot of "Claude Code + Hermes both alive,
// with one archived session in history" used to seed the workspace for
// public-facing launch screenshots and walkthroughs.
//
// Pure data only. The wiring side effects (mutating sessions / activating
// the scene / removing it) live in main.js so this module stays
// trivially loadable from any context.

import { LIFECYCLE } from "../state/sessionLifecycle.js";

export function demoTimestamp(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

export function createDemoTurn(id, task, state, thoughts, finalResponse, logs, minutesAgo, meta = {}) {
  return {
    id,
    task,
    state,
    thoughts,
    outputs: [finalResponse],
    finalResponse,
    logs,
    createdAt: demoTimestamp(minutesAgo),
    meta,
  };
}

export function isDemoSession(session) {
  return Boolean(session?.id && session.id.startsWith("demo-session-"));
}

export function isDemoSessionId(sessionId) {
  return Boolean(sessionId && String(sessionId).startsWith("demo-session-"));
}

export function buildLaunchDemoSessions() {
  const hermesMeta = {
    profileName: "ailearning",
    profileAlias: "ailearning",
    profileExecutable: "ailearning",
    profileModel: "MiniMax M2",
    gateway: "Gateway API",
    skillCount: 4,
    hasSoul: true,
  };
  const claudeTurn = createDemoTurn(
    "demo-turn-claude-review",
    "Audit the LunaAgentOS desktop shell and explain what should be visible in the first GitHub launch screenshot.",
    5,
    [
      "I will treat the app as a runtime workspace rather than a chat UI. The screenshot should prove heterogeneous entries, persistent sessions, live process visibility, and local history in one glance.",
    ],
    "## Launch screenshot checklist\n\n| Surface | What it proves | Status |\n|---|---|---|\n| Agent Fleet | Claude Code and Hermes are real external entries | Ready |\n| Runtime Session Card | Output, thought stream, runtime stream, and final response live together | Ready |\n| Session List | Live sessions and archived sessions have separate lifecycle meaning | Ready |\n\n```mermaid\nflowchart LR\n  Fleet[Agent Fleet] --> Cards[Runtime Session Cards]\n  Cards --> History[Local JSON History]\n```\n\nThe screenshot should make LunaAgentOS feel like a control layer, not another chat wrapper.",
    [
      "Parsed workspace structure: desktop-shell/src/main.js, styles.css, src-tauri/src/lib.rs",
      "Detected capability: session cards, copy transcript, fullscreen, live/archived lifecycle",
      "Saved launch summary into local session history",
    ],
    18,
  );
  const hermesTurn = createDemoTurn(
    "demo-turn-hermes-live",
    "Use Hermes to inspect the repo positioning and keep the slow runtime process visible.",
    3,
    [
      "Thinking through product positioning: LunaAgentOS should not claim to replace Claude Code or Hermes. It should present itself as the neutral desktop control layer above them.",
      "The key difference from a normal chat UI is process observability: thought, tool, plan, usage, and final response remain attached to the session card.",
    ],
    "Working on positioning notes…\n\n- Keep the Stage 1 boundary honest\n- Show Claude Code + Hermes in the same workspace\n- Treat each card as a persistent Runtime Session Surface\n- Keep slow Hermes work visible instead of hiding it behind a spinner",
    [
      "plan: compare amux / Goose / Fusion positioning",
      "tool: read docs/competitive-positioning.md",
      "usage: input 8.4k · output 1.2k · total 9.6k",
      "session/update: agent_message_chunk streamed into card",
    ],
    7,
    { hermesProfile: hermesMeta },
  );
  return [
    {
      id: "demo-session-hermes-live",
      providerId: "hermes",
      providerName: "Hermes",
      agentId: "hermes-demo-ailearning",
      agentName: "Hermes / ailearning",
      task: hermesTurn.task,
      state: 3,
      lifecycle: LIFECYCLE.live,
      runtimeState: LIFECYCLE.live,
      turns: [hermesTurn],
      createdAt: demoTimestamp(7),
      fullscreen: false,
      acpSessionId: null,
      profileName: hermesMeta.profileName,
      profileAlias: hermesMeta.profileAlias,
      profileExecutable: hermesMeta.profileExecutable,
      profileModel: hermesMeta.profileModel,
      gateway: hermesMeta.gateway,
      skillCount: hermesMeta.skillCount,
      hasSoul: hermesMeta.hasSoul,
    },
    {
      id: "demo-session-claude-review",
      providerId: "claude",
      providerName: "Claude Code",
      agentId: "claude-main",
      agentName: "Claude Code / 主会话",
      task: claudeTurn.task,
      state: 5,
      lifecycle: LIFECYCLE.live,
      runtimeState: LIFECYCLE.live,
      turns: [claudeTurn],
      createdAt: demoTimestamp(18),
      fullscreen: false,
      acpSessionId: null,
    },
  ];
}

export function buildLaunchDemoHistoryEntries(historySchemaVersion) {
  const archivedTurn = createDemoTurn(
    "demo-turn-archive-roadmap",
    "Summarize Stage 1 boundary and next launch risks.",
    5,
    ["Stage 1 is a minimal heterogeneous console. Do not expand into orchestration before the first public version is understandable."],
    "Stage 1 is enough for a first GitHub launch candidate when the repo clearly shows: real entries, session cards, process visibility, local history, and honest limitations.",
    ["Loaded from local JSON archive", "Runtime is not attached; transcript remains readable"],
    180,
  );
  return [{
    schema_version: historySchemaVersion,
    id: "demo-history-roadmap",
    date: demoTimestamp(180).slice(0, 10),
    created_at: archivedTurn.createdAt,
    provider_id: "claude",
    provider_name: "Claude Code",
    agent_id: "claude-main",
    agent_name: "Claude Code / 主会话",
    session_id: "demo-session-archive-roadmap",
    acp_session_id: null,
    task: archivedTurn.task,
    status: "DONE",
    summary: archivedTurn.finalResponse,
    turn: archivedTurn,
  }];
}
