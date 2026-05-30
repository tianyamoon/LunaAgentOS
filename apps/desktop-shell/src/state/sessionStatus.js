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
  return turns.find((turn) => activeTurnId && turn.id === activeTurnId) || turns[turns.length - 1];
}

export function latestTurnOutcome(session) {
  const turn = latestTurn(session);
  if (!turn) return null;
  const status = turn.status || TURN_STATUS.created;
  return Object.values(TURN_STATUS).includes(status) ? status : TURN_STATUS.created;
}

export function isRunningTurnStatus(status) {
  return status === TURN_STATUS.running || status === TURN_STATUS.waiting_confirmation;
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
  if (payloadStatus === "failed") return TURN_STATUS.failed;
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
  const turnStatus = turn?.status || TURN_STATUS.created;
  const secondary = latestTurnOutcome(session);

  if (accessMode === ACCESS_MODE.read_only) {
    return buildStatusView(CARD_STATUS.readonly_history, translate, { secondary });
  }

  if (recordState === RECORD_STATE.archived) {
    return buildStatusView(CARD_STATUS.archived, translate, { secondary });
  }

  if (runtimeBinding.state === RUNTIME_BINDING_STATE.failed) {
    const status = BLOCKING_RUNTIME_STAGES.has(runtimeBinding.stage) ? CARD_STATUS.blocked : CARD_STATUS.failed;
    return buildStatusView(status, translate, { error: runtimeErrorView(runtimeBinding, translate) });
  }

  if (!turn || turnStatus === TURN_STATUS.created || turnStatus === TURN_STATUS.cancelled) {
    return buildStatusView(CARD_STATUS.waiting_input, translate, { secondary });
  }

  if (turnStatus === TURN_STATUS.running) return buildStatusView(CARD_STATUS.running, translate);
  if (turnStatus === TURN_STATUS.waiting_confirmation) return buildStatusView(CARD_STATUS.waiting_confirmation, translate);
  if (turnStatus === TURN_STATUS.completed) return buildStatusView(CARD_STATUS.completed, translate);
  if (turnStatus === TURN_STATUS.failed) return buildStatusView(CARD_STATUS.failed, translate);

  return buildStatusView(CARD_STATUS.waiting_input, translate, { secondary });
}

function buildStatusView(status, translate, { secondary = null, error = null } = {}) {
  const meta = CARD_STATUS_META[status] || CARD_STATUS_META.waiting_input;
  return {
    status,
    label: translateOrFallback(translate, meta.labelKey),
    detail: error?.detail || translateOrFallback(translate, meta.detailKey),
    tone: meta.tone,
    icon: meta.icon,
    secondary_status: secondaryStatusView(secondary, translate),
    error,
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
