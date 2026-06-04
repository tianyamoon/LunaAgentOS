// History Entries Module。
// 这里把磁盘条目投影为归档 Session。兼容 snake_case 与旧 camelCase，但不理解具体 Adapter。

// 从新旧字段中提取稳定的 Session 标识。
export function historySessionKey(entry) {
  if (!entry) return null;
  return entry.sessionId || entry.session_id || entry.id || null;
}

// 使用 Session 与 Turn 标识构造条目去重键。
export function historyTurnKey(entry) {
  const sessionKey = historySessionKey(entry);
  const turnId = entry?.turn?.id || entry?.id || null;
  return `${sessionKey}:${turnId}`;
}

// 旧历史没有 Prompt Run 写入租约，只能保守标记，不能根据正文相似度猜测修复归属。
export function projectHistoryTurnIntegrity(turn) {
  if (!turn) return turn;
  const historyIntegrity = turn.promptRunId ? "verified_prompt_run" : "legacy_unverified";
  return {
    ...turn,
    meta: {
      ...(turn.meta || {}),
      historyIntegrity,
    },
  };
}

// 把磁盘 History 条目聚合为只读归档 Session，并允许调用方补充运行时归一化。
export function archivedSessionsFromHistory(entries, { normalizeSession } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const bySession = new Map();
  list.forEach((entry) => {
    const key = historySessionKey(entry);
    const createdAt = entry.createdAt || entry.created_at;
    if (!key || !createdAt) return;
    const turn = projectHistoryTurnIntegrity(entry.turn || {
      id: entry.id,
      task: entry.task,
      state: 5,
      status: entry.status || "completed",
      thoughts: [],
      outputs: [],
      finalResponse: entry.summary,
      logs: ["由历史归档恢复，当前不是运行中的 runtime session。"],
      createdAt,
    });
    const current = bySession.get(key);
    // 新历史保存通用入口快照；旧 Hermes metadata 仅作为向后兼容读取。
    const agentEntrySnapshot = entry.agentEntrySnapshot || entry.agent_entry_snapshot || null;
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
        record_state: entry.record_state || "archived",
        access_mode: entry.access_mode || "read_only",
        runtime_binding: entry.runtime_binding || null,
        agentEntrySnapshot,
        hermesProfile,
      });
      return;
    }
    current.updatedAt = current.updatedAt > createdAt ? current.updatedAt : createdAt;
    current.summary = entry.summary || current.summary;
    current.turnCount += 1;
    current.turns.push(turn);
    current.agentEntrySnapshot = current.agentEntrySnapshot || agentEntrySnapshot;
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
