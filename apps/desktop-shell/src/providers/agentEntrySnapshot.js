// Agent Entry Snapshot Module。
// 把可运行入口投影为可持久化的通用快照，让 History 与恢复流程不再理解具体 Adapter。

// 删除空值并保持顺序，避免 identityKeys 在多轮持久化中不断膨胀。
function compactIdentityKeys(values) {
  return [...new Set(values.flat().filter((value) => String(value || "").trim()).map(String))];
}

// 复制 Adapter 提供的 opaque metadata，避免调用方修改原对象。
function cloneMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

// 收集 Agent Entry 可用于恢复匹配的稳定身份线索。
function identityKeysFromEntry(entry = {}) {
  return compactIdentityKeys([
    entry.identityKeys || [],
    entry.id,
    entry.agentId,
    entry.targetId,
    entry.profileName,
    entry.profileAlias,
    entry.alias,
    entry.profileExecutable,
    entry.profilePath,
    entry.path,
  ]);
}

// 把当前 Agent Entry 投影为与 Adapter 无关的持久化快照。
export function snapshotAgentEntry(agent = {}) {
  return {
    agentId: agent.agentId || agent.id || null,
    providerId: agent.providerId || null,
    targetId: agent.targetId || agent.id || agent.agentId || null,
    targetName: agent.targetName || agent.displayName || agent.name || agent.agentName || null,
    runtimeInstanceId: agent.runtimeInstanceId || null,
    runtimeLabel: agent.runtimeLabel || null,
    launch: {
      runtimeHost: agent.runtimeHost || null,
      runtimeCommand: agent.runtimeCommand ?? null,
      profileExecutable: agent.profileExecutable || agent.profileAlias || agent.alias || null,
    },
    identityKeys: identityKeysFromEntry(agent),
    metadata: cloneMetadata(agent.metadata || agent.adapterMetadata),
  };
}

// 把 Runtime Session 中冻结的入口身份投影为同一快照形状。
export function snapshotRuntimeSession(session = {}) {
  return snapshotAgentEntry({
    ...session,
    id: session.targetId || session.agentId,
    agentId: session.agentId,
    targetId: session.targetId || session.agentId,
    targetName: session.targetName || session.agentName,
  });
}

// 从旧 History Entry 中读取 Hermes profile，并包装为通用快照。
// 这个函数是唯一允许理解 legacy hermesProfile 形状的兼容 Seam。
export function readLegacyHermesSnapshot(archived = {}) {
  const profile = archived.hermesProfile
    || archived.turns?.find((turn) => turn?.meta?.hermesProfile)?.meta?.hermesProfile
    || archived.turn?.meta?.hermesProfile
    || null;
  if (!profile) return null;
  return snapshotAgentEntry({
    id: archived.targetId || archived.agentId,
    agentId: archived.agentId,
    providerId: archived.providerId,
    targetId: archived.targetId || archived.agentId,
    targetName: archived.targetName || archived.agentName,
    runtimeInstanceId: archived.runtimeInstanceId,
    runtimeLabel: archived.runtimeLabel,
    runtimeHost: archived.runtimeHost,
    runtimeCommand: archived.runtimeCommand,
    ...profile,
    metadata: { ...profile, legacyHermesProfile: { ...profile } },
  });
}

// 使用 provider 与 identityKeys 在当前 Agent Entry 集合中寻找恢复目标。
export function matchAgentEntry(snapshot, entries = []) {
  if (!snapshot) return null;
  const snapshotKeys = new Set(identityKeysFromEntry(snapshot));
  return (Array.isArray(entries) ? entries : []).find((entry) => {
    if (snapshot.providerId && entry.providerId !== snapshot.providerId) return false;
    return identityKeysFromEntry(entry).some((key) => snapshotKeys.has(key));
  }) || null;
}
