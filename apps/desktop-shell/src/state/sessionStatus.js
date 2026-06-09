import { timelineItemsForTurn } from "../ui/turnTimelineProjection.js";

export const RECORD_STATE = Object.freeze({
  active: "active",
  archived: "archived",
  deleted: "deleted",
});

export const ACCESS_MODE = Object.freeze({
  interactive: "interactive",
  read_only: "read_only",
});

export const RUNTIME_BINDING_STATE = Object.freeze({
  idle: "idle",
  connecting: "connecting",
  connected: "connected",
  reconnecting: "reconnecting",
  failed: "failed",
});

export const RUNTIME_BINDING_STAGE = Object.freeze({
  launch: "launch",
  initialize: "initialize",
  load: "load",
  runtime: "runtime",
  resume: "resume",
  prompt: "prompt",
  shutdown: "shutdown",
});

export const TURN_STATUS = Object.freeze({
  created: "created",
  running: "running",
  waiting_confirmation: "waiting_confirmation",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export const CARD_STATUS = Object.freeze({
  waiting_input: "waiting_input",
  running: "running",
  waiting_confirmation: "waiting_confirmation",
  blocked: "blocked",
  failed: "failed",
  completed: "completed",
  archived: "archived",
  readonly_history: "readonly_history",
});

export const CARD_STATUS_META = Object.freeze({
  waiting_input: { labelKey: "sessionStatus.waitingInput", detailKey: "sessionStatus.waitingInputDetail", tone: "neutral", icon: "dot" },
  running: { labelKey: "sessionStatus.running", detailKey: "sessionStatus.runningDetail", tone: "busy", icon: "spinner" },
  waiting_confirmation: { labelKey: "sessionStatus.waitingConfirmation", detailKey: "sessionStatus.waitingConfirmationDetail", tone: "attention", icon: "warning" },
  blocked: { labelKey: "sessionStatus.blocked", detailKey: "sessionStatus.blockedDetail", tone: "danger", icon: "warning" },
  failed: { labelKey: "sessionStatus.failed", detailKey: "sessionStatus.failedDetail", tone: "danger", icon: "warning" },
  completed: { labelKey: "sessionStatus.completed", detailKey: "sessionStatus.completedDetail", tone: "success", icon: "check" },
  archived: { labelKey: "sessionStatus.archived", detailKey: "sessionStatus.archivedDetail", tone: "muted", icon: "archive" },
  readonly_history: { labelKey: "sessionStatus.readonlyHistory", detailKey: "sessionStatus.readonlyHistoryDetail", tone: "muted", icon: "lock" },
});

export const SESSION_STATUS_KIND = Object.freeze({
  live: "live",
  readonly_history: "readonly_history",
  archived: "archived",
  deleted: "deleted",
});

export const SESSION_LIST_SIGNAL = Object.freeze({
  live: "live",
  failed: "failed",
  readonly_history: "readonly_history",
  archived: "archived",
  deleted: "deleted",
  inactive: "inactive",
});

const BLOCKING_RUNTIME_STAGES = new Set([
  RUNTIME_BINDING_STAGE.launch,
  RUNTIME_BINDING_STAGE.initialize,
  RUNTIME_BINDING_STAGE.load,
  RUNTIME_BINDING_STAGE.runtime,
  RUNTIME_BINDING_STAGE.resume,
]);

const DEFAULT_ZH = Object.freeze({
  "sessionStatus.waitingInput": "等待输入",
  "sessionStatus.waitingInputDetail": "当前没有运行中的任务，可以继续输入。",
  "sessionStatus.running": "运行中",
  "sessionStatus.runningDetail": "Agent 正在处理当前任务。",
  "sessionStatus.waitingConfirmation": "等待确认",
  "sessionStatus.waitingConfirmationDetail": "当前任务正在等待用户确认。",
  "sessionStatus.blocked": "受阻",
  "sessionStatus.blockedDetail": "当前会话需要先处理连接或环境问题。",
  "sessionStatus.failed": "失败",
  "sessionStatus.failedDetail": "最近一次运行失败。",
  "sessionStatus.completed": "已完成",
  "sessionStatus.completedDetail": "最近一轮任务已完成，可以继续输入。",
  "sessionStatus.archived": "已归档",
  "sessionStatus.archivedDetail": "这张会话卡已归档。",
  "sessionStatus.readonlyHistory": "只读历史",
  "sessionStatus.readonlyHistoryDetail": "这张会话来自历史记录，只能查看。",
  "sessionStatus.secondary.completed": "上次已完成",
  "sessionStatus.secondary.failed": "上次失败",
  "sessionStatus.secondary.cancelled": "上次已取消",
  "sessionStatus.secondary.running": "上次仍在运行",
  "sessionStatus.secondary.waiting_confirmation": "上次等待确认",
  "sessionStatus.secondary.created": "尚未运行",
  "sessionStatus.error.defaultTitle": "Runtime 连接失败",
  "sessionStatus.error.defaultSuggestion": "请检查 runtime 配置、运行环境和 Agent profile 后重试。",
});

export function createRuntimeBinding(overrides = {}) {
  return {
    state: RUNTIME_BINDING_STATE.idle,
    stage: null,
    error_title: null,
    error_detail: null,
    error_suggestion: null,
    ...overrides,
  };
}

export function latestTurn(session) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  return turns.length ? turns[turns.length - 1] : null;
}

export function activeOrLatestTurn(session) {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  if (!turns.length) return null;
  const activeTurnId = session?.activeTurnId;
  const latest = turns[turns.length - 1];
  const active = turns.find((turn) => activeTurnId && turn.id === activeTurnId) || null;
  if (!active || active === latest) return latest;
  if (isTerminalTurnStatus(latest?.status) && isRunningTurnStatus(active?.status)) return latest;
  return active;
}

export function latestTurnOutcome(session) {
  const turn = latestTurn(session);
  if (!turn) return null;
  const status = turn.status || TURN_STATUS.created;
  return Object.values(TURN_STATUS).includes(status) ? status : TURN_STATUS.created;
}

function resolveVisibleTurnStatus(turn, { readOnly = false } = {}) {
  const status = turn?.status || TURN_STATUS.created;
  if (!readOnly) return status;
  if (status === TURN_STATUS.completed || status === TURN_STATUS.failed) return status;
  if (hasReadableTurnResult(turn)) return TURN_STATUS.completed;
  if (status === TURN_STATUS.waiting_confirmation || status === TURN_STATUS.running) return TURN_STATUS.created;
  return status;
}

function hasReadableTurnResult(turn) {
  if (!turn) return false;
  if (String(turn.finalResponse || "").trim()) return true;
  if (Array.isArray(turn.outputs) && turn.outputs.some((output) => String(output || "").trim())) return true;
  if (Array.isArray(turn.timelineItems)) {
    return turn.timelineItems.some((item) => item?.type === "assistant" && String(item.content || "").trim());
  }
  return false;
}

export function isRunningTurnStatus(status) {
  return status === TURN_STATUS.running || status === TURN_STATUS.waiting_confirmation;
}

export function isTerminalTurnStatus(status) {
  return status === TURN_STATUS.completed || status === TURN_STATUS.failed || status === TURN_STATUS.cancelled;
}

export function statusFromRuntimeStateCode(state, hasFinalResponse = false) {
  if (state === 9) return TURN_STATUS.failed;
  if (state === 6) return TURN_STATUS.cancelled;
  if (state === 5) return TURN_STATUS.completed;
  if (state === 0 || state === 1 || state === 2 || state === 3 || state === 4) return TURN_STATUS.running;
  return hasFinalResponse ? TURN_STATUS.completed : TURN_STATUS.created;
}

export function statusFromRuntimeEvent(event, currentStatus = TURN_STATUS.created, hasFinalResponse = false) {
  if (!event) return currentStatus;
  const payloadStatus = normalizeRuntimeStatusText(event.payload?.status || event.status || event.payload?.state);
  if (payloadStatus === "waiting_confirmation") return TURN_STATUS.waiting_confirmation;
  // 单个工具失败仍允许 Agent 自行恢复；只有运行时或 prompt 终态失败才结束整个 Turn。
  if (payloadStatus === "failed" && event.type !== "tool") return TURN_STATUS.failed;
  if (payloadStatus === "completed" && event.type === "state") return TURN_STATUS.completed;
  if (typeof event.state === "number") return statusFromRuntimeStateCode(event.state, hasFinalResponse);
  if (event.type === "response") return TURN_STATUS.running;
  if (event.type === "thought" || event.type === "tool" || event.type === "plan") return TURN_STATUS.running;
  return currentStatus;
}

export function normalizeSessionStatusShape(session) {
  if (!session) return session;
  if (!session.record_state) session.record_state = RECORD_STATE.active;
  if (!session.access_mode) session.access_mode = ACCESS_MODE.interactive;
  if (!session.runtime_binding) session.runtime_binding = createRuntimeBinding();
  const turns = Array.isArray(session.turns) ? session.turns : [];
  turns.forEach((turn) => {
    if (!turn.status) turn.status = statusFromRuntimeStateCode(turn.state, Boolean(turn.finalResponse));
  });
  return session;
}

export function resolveSessionCardStatusView(session, options = {}) {
  const translate = typeof options.translate === "function" ? options.translate : defaultTranslate;
  const recordState = session?.record_state || RECORD_STATE.active;
  const accessMode = session?.access_mode || ACCESS_MODE.interactive;
  const runtimeBinding = session?.runtime_binding || createRuntimeBinding();
  const turn = activeOrLatestTurn(session);
  const turnStatus = resolveVisibleTurnStatus(turn, { readOnly: accessMode === ACCESS_MODE.read_only });
  const secondary = latestTurnOutcome(session);

  if (recordState === RECORD_STATE.archived) {
    // 归档是用户动作，优先于只读访问模式，避免手动归档被显示成普通历史记录。
    return buildStatusView(CARD_STATUS.archived, translate, { secondary });
  }

  if (runtimeBinding.state === RUNTIME_BINDING_STATE.failed) {
    const status = BLOCKING_RUNTIME_STAGES.has(runtimeBinding.stage) ? CARD_STATUS.blocked : CARD_STATUS.failed;
    return buildStatusView(status, translate, { error: runtimeErrorView(runtimeBinding, translate) });
  }

  if (accessMode === ACCESS_MODE.read_only && (!turn || turnStatus === TURN_STATUS.created || turnStatus === TURN_STATUS.cancelled)) {
    // 只读是访问模式；没有可证明的执行结果时才展示为历史记录。
    return buildStatusView(CARD_STATUS.readonly_history, translate);
  }

  if (runtimeBinding.state === RUNTIME_BINDING_STATE.reconnecting) {
    return buildStatusView(CARD_STATUS.running, translate, { secondary });
  }

  if (!turn || turnStatus === TURN_STATUS.created || turnStatus === TURN_STATUS.cancelled) {
    return buildStatusView(CARD_STATUS.waiting_input, translate, { secondary });
  }

  if (turnStatus === TURN_STATUS.running) {
    const activity = resolveActivityDescription(turn, translate);
    return buildStatusView(CARD_STATUS.running, translate, { activity });
  }
  if (turnStatus === TURN_STATUS.waiting_confirmation) {
    const activity = resolveActivityDescription(turn, translate);
    return buildStatusView(CARD_STATUS.waiting_confirmation, translate, { activity });
  }
  if (turnStatus === TURN_STATUS.completed) {
    const summary = projectCompletedTimelineSummary(turn);
    return buildStatusView(CARD_STATUS.completed, translate, { summary });
  }
  if (turnStatus === TURN_STATUS.failed) {
    const activity = resolveActivityDescription(turn, translate);
    return buildStatusView(CARD_STATUS.failed, translate, { activity });
  }

  return buildStatusView(CARD_STATUS.waiting_input, translate, { secondary });
}

export function resolveSessionCanonicalState(session, options = {}) {
  const translate = typeof options.translate === "function" ? options.translate : defaultTranslate;
  const recordState = session?.record_state || RECORD_STATE.active;
  const accessMode = session?.access_mode || ACCESS_MODE.interactive;
  const statusView = resolveSessionCardStatusView(session, { translate });
  const canSend = typeof options.canSendToSession === "function"
    ? Boolean(options.canSendToSession(session))
    : fallbackCanSendToSession(session, statusView);
  const canRestore = typeof options.canRestoreSession === "function"
    ? Boolean(options.canRestoreSession(session))
    : fallbackCanRestoreSession(session);

  const isDeleted = recordState === RECORD_STATE.deleted;
  const isArchived = recordState === RECORD_STATE.archived;
  const isReadOnly = accessMode === ACCESS_MODE.read_only;
  const isFailure = statusView.status === CARD_STATUS.failed || statusView.status === CARD_STATUS.blocked;
  const kind = resolveSessionStatusKind({ isDeleted, isArchived, isReadOnly });
  const listSignal = resolveSessionListSignal({ canSend, isArchived, isDeleted, isFailure, isReadOnly });

  return {
    recordState,
    accessMode,
    kind,
    listSignal,
    statusView,
    canSend,
    canRestore,
    isArchived,
    isDeleted,
    isReadOnly,
    // 只有可交互且未归档/删除的会话才算挂在 runtime 上，避免历史快照污染工作区状态。
    isRuntimeAttached: canSend || (!isReadOnly && !isArchived && !isDeleted),
  };
}

export function resolveSessionListPresentationState(session, options = {}) {
  const translate = typeof options.translate === "function" ? options.translate : defaultTranslate;
  const canonical = resolveSessionCanonicalState(session, {
    translate,
    canSendToSession: options.canSendToSession,
    canRestoreSession: options.canRestoreSession,
  });
  const statusView = canonical.statusView;
  const isFailedOrBlocked = canonical.listSignal === SESSION_LIST_SIGNAL.failed;
  const isSendable = canonical.canSend;

  // 右侧列表只消费这个投影，不再自行组合 record/access/runtime 与 turn 状态。
  if (isFailedOrBlocked) {
    return {
      canonical,
      statusView,
      isFailedOrBlocked,
      isSendable,
      signalClass: "signal-failed",
      signalLabel: statusView.label,
      listStateClass: canonical.isArchived ? "is-archive" : "is-active-history",
    };
  }

  if (isSendable) {
    return {
      canonical,
      statusView,
      isFailedOrBlocked,
      isSendable,
      signalClass: "signal-active",
      signalLabel: translateOrFallback(translate, "history.signal.live"),
      listStateClass: canonical.isArchived ? "is-archive" : "is-active-history",
    };
  }

  return {
    canonical,
    statusView,
    isFailedOrBlocked,
    isSendable,
    signalClass: "signal-archive",
    signalLabel: statusView.label,
    listStateClass: canonical.isArchived ? "is-archive" : "is-active-history",
  };
}

export function resolveSessionCardControlState(session, options = {}) {
  const translate = typeof options.translate === "function" ? options.translate : defaultTranslate;
  const canonical = resolveSessionCanonicalState(session, {
    translate,
    canSendToSession: options.canSendToSession,
    canRestoreSession: options.canRestoreSession,
  });
  const runtimeBinding = session?.runtime_binding || createRuntimeBinding();
  const statusView = canonical.statusView;
  const isWaiting = statusView.status === CARD_STATUS.running
    || statusView.status === CARD_STATUS.waiting_confirmation;
  const isRestoring = runtimeBinding.state === RUNTIME_BINDING_STATE.reconnecting;
  const managementDisabled = isRestoring;
  const isInteractiveActive = canonical.recordState === RECORD_STATE.active
    && canonical.accessMode === ACCESS_MODE.interactive;

  // 卡片按钮只消费这个投影，避免视图重新解释 record/access/runtime 三套状态。
  return {
    canonical,
    statusView,
    isWaiting,
    isRestoring,
    managementDisabled,
    canStop: isWaiting && isInteractiveActive,
    canArchive: canonical.recordState !== RECORD_STATE.archived
      && canonical.recordState !== RECORD_STATE.deleted
      && canonical.accessMode !== ACCESS_MODE.read_only,
    canRestore: canonical.canRestore,
    actionDigest: [
      canonical.kind,
      canonical.listSignal,
      statusView.status,
      statusView.tone,
      isWaiting,
      isRestoring,
      managementDisabled,
      canonical.recordState,
      canonical.accessMode,
      canonical.canRestore,
    ].join("|"),
  };
}

function resolveSessionStatusKind({ isDeleted, isArchived, isReadOnly }) {
  if (isDeleted) return SESSION_STATUS_KIND.deleted;
  if (isArchived) return SESSION_STATUS_KIND.archived;
  if (isReadOnly) return SESSION_STATUS_KIND.readonly_history;
  return SESSION_STATUS_KIND.live;
}

function resolveSessionListSignal({ canSend, isArchived, isDeleted, isFailure, isReadOnly }) {
  if (isDeleted) return SESSION_LIST_SIGNAL.deleted;
  if (isArchived) return SESSION_LIST_SIGNAL.archived;
  if (isFailure) return SESSION_LIST_SIGNAL.failed;
  if (canSend) return SESSION_LIST_SIGNAL.live;
  if (isReadOnly) return SESSION_LIST_SIGNAL.readonly_history;
  return SESSION_LIST_SIGNAL.inactive;
}

function fallbackCanSendToSession(session, statusView) {
  const recordState = session?.record_state || RECORD_STATE.active;
  const accessMode = session?.access_mode || ACCESS_MODE.interactive;
  return recordState === RECORD_STATE.active
    && accessMode === ACCESS_MODE.interactive
    && statusView.status !== CARD_STATUS.blocked
    && statusView.status !== CARD_STATUS.failed
    && statusView.status !== CARD_STATUS.archived
    && statusView.status !== CARD_STATUS.readonly_history;
}

function fallbackCanRestoreSession(session) {
  return Boolean(session?.acpSessionId)
    && (session?.record_state === RECORD_STATE.archived || session?.access_mode === ACCESS_MODE.read_only);
}

function buildStatusView(status, translate, { secondary = null, error = null, activity = null, summary = null } = {}) {
  const meta = CARD_STATUS_META[status] || CARD_STATUS_META.waiting_input;
  return {
    status,
    label: translateOrFallback(translate, meta.labelKey),
    detail: error?.detail || translateOrFallback(translate, meta.detailKey),
    tone: meta.tone,
    icon: meta.icon,
    secondary_status: secondaryStatusView(secondary, translate),
    error,
    activity,
    summary,
  };
}

function secondaryStatusView(status, translate) {
  if (!status) return null;
  if (!Object.values(TURN_STATUS).includes(status)) return null;
  return {
    status,
    label: translateOrFallback(translate, `sessionStatus.secondary.${status}`),
  };
}

function runtimeErrorView(runtimeBinding, translate) {
  return {
    title: runtimeBinding.error_title || translateOrFallback(translate, "sessionStatus.error.defaultTitle"),
    stage: runtimeBinding.stage || null,
    detail: runtimeBinding.error_detail || "",
    suggestion: runtimeBinding.error_suggestion || translateOrFallback(translate, "sessionStatus.error.defaultSuggestion"),
  };
}

function normalizeRuntimeStatusText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (/approval|permission|confirm|confirmation|确认|权限|批准/.test(text)) return "waiting_confirmation";
  if (/error|fail|failed|rejected|denied|失败|错误|拒绝/.test(text)) return "failed";
  if (/done|complete|completed|success|finished|完成|成功/.test(text)) return "completed";
  return "";
}

function translateOrFallback(translate, key) {
  const value = translate(key);
  if (value && value !== key) return value;
  return DEFAULT_ZH[key] || key;
}

function defaultTranslate(key) {
  return DEFAULT_ZH[key] || key;
}

// 从当前 turn 的 timeline 提取活动描述，用于状态 chip
function resolveActivityDescription(turn, translate) {
  const items = timelineItemsForTurn(turn);
  if (!items || !items.length) return null;

  // 优先找 running 状态的事件
  const activeItem = items.find((item) => item.status === "running") || items.at(-1);
  if (!activeItem) return null;

  if (activeItem.type === "thinking") {
    const title = (activeItem.content || "").split("\n")[0]?.slice(0, 40);
    return { kind: "thinking", text: title || translate("turn.timeline.thinking") };
  }
  if (activeItem.type === "tool") {
    return { kind: "tool", text: (activeItem.content || "").slice(0, 40) || translate("turn.timeline.kind.tool") };
  }
  if (activeItem.type === "permission") {
    return { kind: "permission", text: (activeItem.content || "").slice(0, 40) };
  }
  if (activeItem.type === "error") {
    return { kind: "error", text: (activeItem.content || "").slice(0, 40) };
  }
  if (activeItem.type === "tool_group") {
    const toolItems = Array.isArray(activeItem.items) ? activeItem.items : [];
    const lastTool = toolItems.at(-1);
    if (lastTool) {
      return { kind: "tool", text: (lastTool.content || "").slice(0, 40) || translate("turn.timeline.kind.tool") };
    }
  }
  return null;
}

// 完成摘要（从 turnTimelineProjection 借用，避免循环依赖）
function projectCompletedTimelineSummary(turn) {
  const items = timelineItemsForTurn(turn);
  const start = turn?.timelineStartedAt || turn?.createdAt;
  const end = turn?.timelineCompletedAt;
  const startMs = Date.parse(start || "");
  const endMs = Date.parse(end || "");
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;
  return {
    durationMs,
    toolCount: items.filter((item) => item.type === "tool").length,
    fileChangeCount: items.filter((item) => item.type === "file_change").length,
    legacyApproximation: items.some((item) => item.metadata?.legacyApproximation),
  };
}
