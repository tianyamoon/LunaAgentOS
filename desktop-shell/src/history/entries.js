// History entry helpers.
//
// Pure transforms over the on-disk history JSON shape that the Tauri
// backend hands us. Backend keys are snake_case but legacy older entries
// use camelCase, so the helpers tolerate both.
//
// archivedSessionsFromHistory takes a `normalizeSession` callback so it
// stays decoupled from the runtime-aware session identity layer. main.js
// passes its own thin wrapper that closes over current providers /
// runtimeInstances state.

export function historySessionKey(entry) {
  if (!entry) return null;
  return entry.sessionId || entry.session_id || entry.acpSessionId || entry.acp_session_id || entry.id || null;
}

export function historyTurnKey(entry) {
  const sessionKey = historySessionKey(entry);
  const turnId = entry?.turn?.id || entry?.id || null;
  return `${sessionKey}:${turnId}`;
}

export function archivedSessionsFromHistory(entries, { normalizeSession } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const bySession = new Map();
  list.forEach((entry) => {
    const key = historySessionKey(entry);
    const createdAt = entry.createdAt || entry.created_at;
    if (!key || !createdAt) return;
    const turn = entry.turn || {
      id: entry.id,
      task: entry.task,
      state: 5,
      thoughts: [],
      outputs: [],
      finalResponse: entry.summary,
      logs: ["由历史归档恢复，当前不是运行中的 runtime session。"],
      createdAt,
    };
    const current = bySession.get(key);
    const hermesProfile = entry.turn?.meta?.hermesProfile || null;
    if (!current) {
      bySession.set(key, {
        id: key,
        date: entry.date,
        createdAt,
        updatedAt: createdAt,
        providerId: entry.providerId || entry.provider_id,
        providerName: entry.providerName || entry.provider_name,
        agentId: entry.agentId || entry.agent_id,
        agentName: entry.agentName || entry.agent_name,
        runtimeInstanceId: entry.runtimeInstanceId || entry.runtime_instance_id || null,
        runtimeLabel: entry.runtimeLabel || entry.runtime_label || null,
        runtimeHost: entry.runtimeHost || entry.runtime_host || null,
        runtimeCommand: entry.runtimeCommand || entry.runtime_command || null,
        targetId: entry.targetId || entry.target_id || entry.agentId || entry.agent_id,
        targetName: entry.targetName || entry.target_name || entry.agentName || entry.agent_name,
        profileExecutable: entry.profileExecutable || entry.profile_executable || null,
        acpSessionId: entry.acpSessionId || entry.acp_session_id,
        title: entry.task,
        summary: entry.summary,
        turnCount: 1,
        turns: [turn],
        runtimeState: entry.runtimeState || entry.runtime_state || "archived",
        hermesProfile,
      });
      return;
    }
    current.updatedAt = current.updatedAt > createdAt ? current.updatedAt : createdAt;
    current.summary = entry.summary || current.summary;
    current.turnCount += 1;
    current.turns.push(turn);
    current.hermesProfile = current.hermesProfile || hermesProfile;
  });
  const normalize = typeof normalizeSession === "function" ? normalizeSession : (session) => session;
  return [...bySession.values()]
    .map((session) => ({
      ...normalize(session),
      turns: session.turns.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
