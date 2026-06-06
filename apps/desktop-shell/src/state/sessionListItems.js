function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function compareDesc(left, right) {
  return compareText(right, left);
}

function fallbackRuntimeBinding(createRuntimeBinding) {
  return typeof createRuntimeBinding === "function" ? createRuntimeBinding() : null;
}

export function projectSessionListItems({
  sessions = [],
  archivedSessions = [],
  normalizeSession,
  ensureSessionStatusShape,
  sessionRuntimeState,
  createRuntimeBinding,
  translate,
  constants,
} = {}) {
  const t = typeof translate === "function" ? translate : (key) => key;
  const recordState = constants?.RECORD_STATE || {};
  const accessMode = constants?.ACCESS_MODE || {};
  const liveItems = sessions.map((session) => {
    ensureSessionStatusShape?.(session);
    const identitySession = normalizeSession?.(session) || session;
    const lastTurn = session.turns?.at?.(-1);
    const inWorkspace = session.inWorkspace !== false;
    return {
      id: session.id,
      date: session.createdAt?.slice?.(0, 10) || "",
      createdAt: session.createdAt,
      updatedAt: lastTurn?.createdAt || session.createdAt,
      providerId: identitySession.providerId,
      providerName: identitySession.providerName,
      agentName: identitySession.agentName,
      title: session.task || t("history.newSession"),
      summary: lastTurn?.finalResponse
        || lastTurn?.outputs?.at?.(-1)
        || lastTurn?.logs?.at?.(-1)
        || t("session.current"),
      turnCount: session.turns?.length || 0,
      runtimeState: sessionRuntimeState?.(session),
      record_state: session.record_state,
      access_mode: session.access_mode,
      runtime_binding: session.runtime_binding,
      turns: session.turns || [],
      activeTurnId: session.activeTurnId || null,
      agentId: identitySession.agentId,
      runtimeInstanceId: identitySession.runtimeInstanceId || null,
      targetId: identitySession.targetId || identitySession.agentId,
      acpSessionId: session.acpSessionId || null,
      // 只把真正留在工作区的 live session 标记为工作区内，避免历史列表状态反向扰动工作区。
      isInWorkspace: inWorkspace,
      isRuntimeAttached: true,
    };
  });
  const liveIds = new Set(liveItems.map((item) => item.id));
  const historyItems = archivedSessions
    .filter((item) => !liveIds.has(item.id))
    .map((item) => ({
      ...item,
      runtimeState: item.runtimeState || "archived",
      // 归档是用户动作；历史记录缺失字段时不能自动推入归档区。
      record_state: item.record_state || recordState.active || "active",
      access_mode: item.access_mode || accessMode.read_only,
      runtime_binding: item.runtime_binding || fallbackRuntimeBinding(createRuntimeBinding),
      isInWorkspace: false,
      isRuntimeAttached: false,
    }));
  return [...liveItems, ...historyItems];
}

export function isArchivedSessionListItem(item, constants = {}) {
  const archivedState = constants?.RECORD_STATE?.archived || "archived";
  // 只按手动记录状态分组；read_only 只是访问模式，不等于归档。
  return item?.record_state === archivedState;
}

export function isActiveSessionListItem(item, constants = {}) {
  return !isArchivedSessionListItem(item, constants);
}

export function compareActiveSessionListItems(left, right) {
  return compareDesc(left?.createdAt, right?.createdAt)
    || compareText(left?.id, right?.id);
}

export function compareArchivedSessionListItems(left, right) {
  return compareDesc(left?.createdAt, right?.createdAt)
    || compareText(left?.id, right?.id);
}
