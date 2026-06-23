// Session Restore Projection Module。
// 负责把归档 Session 投影为可进入工作区的 Runtime Session；这里不理解任何具体 Adapter。
import { readLegacyHermesSnapshot, matchAgentEntry } from "../providers/agentEntrySnapshot.js";
import { LIFECYCLE } from "./sessionLifecycle.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  RUNTIME_BINDING_STATE,
  createRuntimeBinding,
} from "./sessionStatus.js";

// 只复制目标对象尚未存在的字段，让当前实时探测结果优先于历史 metadata。
function assignMissing(target, source = {}) {
  Object.entries(source).forEach(([key, value]) => {
    if (target[key] == null && value != null) target[key] = value;
  });
  return target;
}

// 从新快照或旧兼容快照中寻找当前 Agent Entry；找不到时合成只读入口。
export function restoreAgentEntryFromArchived(archived, entries = []) {
  const snapshot = archived.agentEntrySnapshot || readLegacyHermesSnapshot(archived);
  const liveEntry = matchAgentEntry(snapshot, entries);
  const launch = snapshot?.launch || {};
  const metadata = snapshot?.metadata || {};
  return {
    id: liveEntry?.id || snapshot?.targetId || archived.targetId || archived.agentId,
    providerId: liveEntry?.providerId || snapshot?.providerId || archived.providerId,
    name: liveEntry?.name || snapshot?.targetName || archived.targetName || archived.agentName,
    runtimeInstanceId: liveEntry?.runtimeInstanceId || snapshot?.runtimeInstanceId || archived.runtimeInstanceId || null,
    runtimeLabel: liveEntry?.runtimeLabel || snapshot?.runtimeLabel || archived.runtimeLabel || null,
    runtimeHost: liveEntry?.runtimeHost || launch.runtimeHost || archived.runtimeHost || null,
    runtimeCommand: liveEntry?.runtimeCommand ?? launch.runtimeCommand ?? archived.runtimeCommand ?? null,
    profileExecutable: liveEntry?.profileExecutable || launch.profileExecutable || archived.profileExecutable || null,
    adapterMetadata: { ...metadata },
    ...metadata,
    ...liveEntry,
  };
}

export function ensureRestoredAgentEntry(agentEntry, {
  providers = [],
  providerById,
  agentById,
  appendProviderAgent,
  translate,
} = {}) {
  const t = typeof translate === "function" ? translate : (key) => key;
  const provider = providerById?.(agentEntry.providerId) || providers[0] || { id: agentEntry.providerId };
  let agent = agentById?.(agentEntry.id);
  if (!agent) {
    agent = {
      ...agentEntry,
      id: agentEntry.id,
      providerId: provider.id,
      name: agentEntry.name?.split(" / ").at(-1) || t("session.historyAgentName"),
      subtitle: t("session.historyAgentSubtitle"),
      note: t("session.historyAgentNote"),
      state: 5,
      isArchivedAgent: true,
    };
    appendProviderAgent?.(provider.id, agent);
  }
  return assignMissing(agent, agentEntry);
}

export function projectWorkspaceSessionFromArchived(archived, {
  existing = null,
  agentEntries = [],
  ensureAgentEntry,
  ...projectionOptions
} = {}) {
  const restoredAgentEntry = restoreAgentEntryFromArchived(archived, agentEntries);
  const restoredAgent = ensureAgentEntry?.(restoredAgentEntry) || restoredAgentEntry;
  return projectSessionFromArchived(archived, {
    existing,
    agentEntry: restoredAgent,
    ...projectionOptions,
  });
}

// 合并归档数据、当前 Agent Entry 和 Runtime 默认值，生成工作区 Session。
export function projectSessionFromArchived(archived, {
  existing = null,
  agentEntry = {},
  runtimeInstances = [],
  runtimeDefaultsForProvider,
  runtimeHostForInstance,
  normalizeSession = (session) => session,
  ensureSessionStatusShape = () => {},
} = {}) {
  const restored = existing || {
    id: archived.id,
    providerId: archived.providerId,
    providerName: archived.providerName,
    agentId: archived.agentId,
    agentName: archived.agentName,
    runtimeInstanceId: archived.runtimeInstanceId || null,
    runtimeLabel: archived.runtimeLabel || null,
    runtimeHost: archived.runtimeHost || null,
    runtimeCommand: archived.runtimeCommand || null,
    targetId: archived.targetId || archived.agentId,
    targetName: archived.targetName || archived.agentName,
    title: archived.title,
    state: 5,
    turns: archived.turns,
    createdAt: archived.createdAt,
    acpSessionId: archived.acpSessionId,
    lifecycle: LIFECYCLE.archived,
    runtimeState: LIFECYCLE.archived,
    // 归档是用户手动分组；恢复投影缺字段时保持活跃历史。
    record_state: archived.record_state || RECORD_STATE.active,
    access_mode: archived.access_mode || ACCESS_MODE.read_only,
    runtime_binding: archived.runtime_binding || createRuntimeBinding({ state: RUNTIME_BINDING_STATE.idle }),
    agentEntrySnapshot: archived.agentEntrySnapshot || null,
  };

  // Adapter metadata 保持 opaque；这里只按缺失字段回填，供后续 Adapter seam 使用。
  assignMissing(restored, agentEntry.adapterMetadata);
  restored.adapterMetadata = { ...(restored.adapterMetadata || {}), ...(agentEntry.adapterMetadata || {}) };
  restored.profileExecutable = restored.profileExecutable || agentEntry.profileExecutable || null;
  restored.runtimeInstanceId = restored.runtimeInstanceId || agentEntry.runtimeInstanceId || null;
  restored.runtimeLabel = restored.runtimeLabel || agentEntry.runtimeLabel || null;
  restored.runtimeHost = restored.runtimeHost || agentEntry.runtimeHost || null;
  restored.runtimeCommand = restored.runtimeCommand ?? agentEntry.runtimeCommand ?? null;

  const restoredInstance = runtimeInstances.find((instance) => instance.id === restored.runtimeInstanceId);
  if (restoredInstance) {
    restored.runtimeLabel = restored.runtimeLabel || restoredInstance.runtimeLabel || null;
    restored.runtimeHost = restored.runtimeHost || runtimeHostForInstance(restoredInstance);
    restored.runtimeCommand = restored.runtimeCommand
      ?? (restoredInstance.commandKind === "manifest" ? null : restoredInstance.command)
      ?? null;
  }

  const runtimeDefaults = runtimeDefaultsForProvider(restored.providerId, restored.runtimeInstanceId);
  restored.runtimeInstanceId = restored.runtimeInstanceId || runtimeDefaults.runtimeInstanceId || null;
  restored.runtimeLabel = restored.runtimeLabel || runtimeDefaults.runtimeLabel || null;
  restored.runtimeHost = restored.runtimeHost || runtimeDefaults.runtimeHost || null;
  restored.runtimeCommand = restored.runtimeCommand ?? runtimeDefaults.runtimeCommand ?? null;
  restored.targetId = restored.targetId || agentEntry.id || restored.agentId;
  restored.inWorkspace = true;
  ensureSessionStatusShape(restored);
  Object.assign(restored, normalizeSession(restored));
  return restored;
}
