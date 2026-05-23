import {
  closeStreamingMarkdown,
  escapeHtml,
  hasMarkdownTable,
  isMarkdownTable,
  normalizeLooseMarkdownTables,
  normalizeRuntimeMarkdown,
  renderCodeFence,
  renderInlineMarkdown,
  renderMarkdownTable,
  renderMermaidDiagrams,
  renderRichText,
} from "./markdown/index.js";
import {
  hermesProfileNameFromAgentId,
  normalizeSessionIdentity,
  normalizedSessionTitle,
  runtimeDefaultsForProvider as identityRuntimeDefaultsForProvider,
  runtimeHostForInstance as identityRuntimeHostForInstance,
} from "./sessionIdentity.js";
import {
  createStickToBottomController,
  createStickToBottomRegistry,
  isAtBottom,
} from "./ui/stickToBottom.js";
import {
  LIFECYCLE,
  InvalidLifecycleTransition,
  canSendLifecycle,
  canRestoreLifecycle,
  canTransition,
  isArchivedLifecycle,
  isDeletedLifecycle,
  isLiveLifecycle,
  isRestoringLifecycle,
  isStoppedLifecycle,
  lifecycleFromLegacy,
  nextLifecycle,
} from "./state/sessionLifecycle.js";
import {
  applyDataI18n,
  getLanguage,
  t,
  toggleLanguage as toggleLanguagePref,
} from "./i18n/index.js";
import {
  buildLaunchDemoHistoryEntries,
  buildLaunchDemoSessions,
  createDemoTurn,
  demoTimestamp,
  isDemoSession,
  isDemoSessionId,
} from "./launchDemo/index.js";
import {
  archivedSessionsFromHistory as archivedSessionsFromHistoryRaw,
  historySessionKey,
} from "./history/entries.js";
import {
  buildHistoryEntryPayload,
  formatCompactHistoryNotice,
  upsertHistoryEntry,
} from "./history/payload.js";
import { createProvidersStore } from "./state/providersStore.js";
import { createSessionsStore } from "./state/sessionsStore.js";
import {
  availableRuntimeInstancesForProvider as availableRuntimeInstancesForProviderRaw,
  providerRuntimeLabel as providerRuntimeLabelRaw,
  runtimeInstanceById as runtimeInstanceByIdRaw,
  runtimeInstancesForProvider as runtimeInstancesForProviderRaw,
  runtimeTargets as runtimeTargetsRaw,
  targetsForRuntimeInstance as targetsForRuntimeInstanceRaw,
} from "./providers/runtimeView.js";
import {
  applyEventsToTurn,
  applyStreamEventToTurn,
} from "./runtime/streamEvents.js";

const { invoke } = window.__TAURI__.core;
const listenRuntimeEvent = window.__TAURI__?.event?.listen?.bind(window.__TAURI__.event);

const stateNames = {
  0: "INIT",
  1: "IDLE",
  2: "THINK",
  3: "TOOLING",
  4: "RESP",
  5: "DONE",
  6: "STOPPED",
  9: "ERROR",
};

const stateDisplayNames = {
  0: "启动中",
  1: "待命",
  2: "思考中",
  3: "调用工具",
  4: "响应中",
  5: "完成",
  6: "已停止",
  9: "异常",
};

const stateDisplayKeys = {
  0: "state.init",
  1: "state.idle",
  2: "state.think",
  3: "state.tooling",
  4: "state.response",
  5: "state.done",
  6: "state.stopped",
  9: "state.error",
};

const stateClasses = {
  0: "state-init",
  1: "state-idle",
  2: "state-think",
  3: "state-tooling",
  4: "state-resp",
  5: "state-done",
  6: "state-stopped",
  9: "state-error",
};

const runtimeStateLabels = {
  live: "可续聊",
  archived: "只读",
  restoring: "重连中",
  resume_failed: "重连失败",
};

const runtimeStateKeys = {
  live: "runtime.live",
  archived: "runtime.archived",
  restoring: "runtime.restoring",
  resume_failed: "runtime.resumeFailed",
};

const runtimeStateClasses = {
  live: "runtime-live",
  archived: "runtime-archived",
  restoring: "runtime-restoring",
  resume_failed: "runtime-failed",
};

const executingSessionStates = new Set([0, 2, 3, 4]);
const HERMES_ACP_STARTUP_NOTICE = "正在启动 ACP 运行时，首次响应可能较慢。";

const acpRuntimeCommands = {
  claude: {
    prompt: "runtime_acp_claude_prompt",
    load: "runtime_acp_claude_load",
    resume: "runtime_acp_claude_resume",
    shutdown: "runtime_acp_claude_shutdown",
    aliveIds: "runtime_acp_claude_alive_ids",
  },
  hermes: {
    prompt: "runtime_acp_hermes_prompt",
    load: "runtime_acp_hermes_load",
    resume: "runtime_acp_hermes_resume",
    shutdown: "runtime_acp_hermes_shutdown",
    aliveIds: "runtime_acp_hermes_alive_ids",
  },
};

const fallbackSessions = {
  hermes: {
    events: [
      { type: "state", state: 0, payload: { content: "Hermes 运行时已探测到，等待真实接线。" } },
      { type: "thought", state: 2, payload: { content: "主 Agent 已切换到 Hermes，但当前版本尚未把任务真正送入 WSL 会话。" } },
      { type: "response", state: 4, payload: { content: "本次只生成了占位会话卡片，下一步将推进 WSL Hermes 的真实执行链路。" } },
      { type: "state", state: 5, payload: { content: "Hermes 占位会话已结束。" } },
    ],
  },
  trae: {
    events: [
      { type: "state", state: 0, payload: { content: "Trae IDE Bridge 入口已预留。" } },
      { type: "thought", state: 2, payload: { content: "当前版本只确认产品位，不把 Trae 伪装成原生 CLI。" } },
      { type: "response", state: 4, payload: { content: "Trae 会在后续通过 IDE Bridge 方式进入工作台。" } },
      { type: "state", state: 5, payload: { content: "Trae 占位会话已结束。" } },
    ],
  },
};

const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const SEND_MODE_KEY = "lunaagentos.sendMode";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const HISTORY_SCHEMA_VERSION = 3;
const DEFAULT_HERMES_AGENT_ID = "hermes-wsl:profile:default";
const SEND_MODE_OPTIONS = ["enter", "ctrlEnter"];
const PROVIDER_AVAILABILITY_STATES = {
  probing: { state: 0, key: "provider.probing" },
  available: { state: 1, key: "provider.available" },
  partial: { state: 2, key: "provider.partial" },
  not_connected: { state: 9, key: "provider.notConnected" },
  not_configured: { state: 9, key: "provider.not_configured" },
  unavailable: { state: 9, key: "provider.unavailable" },
  planned: { state: 6, key: "provider.planned" },
};
const FONT_SCALE_OPTIONS = [
  { id: "compact", labelKey: "font.compact", scale: 0.92 },
  { id: "default", labelKey: "font.default", scale: 1 },
  { id: "comfortable", labelKey: "font.comfortable", scale: 1.08 },
];

function providerAvailabilityLabel(summary) {
  const key = PROVIDER_AVAILABILITY_STATES[summary]?.key;
  return key ? t(key) : summary;
}

function stateDisplayLabel(state) {
  return stateDisplayKeys[state] ? t(stateDisplayKeys[state]) : stateDisplayNames[state] || "UNKNOWN";
}

function runtimeStateLabel(runtimeState) {
  return runtimeStateKeys[runtimeState] ? t(runtimeStateKeys[runtimeState]) : runtimeStateLabels[runtimeState] || runtimeState;
}

const agentList = document.getElementById("agentList");
const providerManagerBtn = document.getElementById("providerManagerBtn");
const workspaceStatus = document.getElementById("workspaceStatus");
const workspaceEmpty = document.getElementById("workspaceEmpty");
const sessionDeck = document.getElementById("sessionDeck");
const sessionStickRegistry = createStickToBottomRegistry({
  factory: (element, opts) => createStickToBottomController(element, { observeResize: false, ...opts }),
});
const historyList = document.getElementById("historyList");
const appNotice = document.getElementById("appNotice");
const promptBox = document.getElementById("promptBox");
const newSessionToggle = document.getElementById("newSessionToggle");
const sendBtn = document.getElementById("sendBtn");
const sendModeBtn = document.getElementById("sendModeBtn");
const fontScaleBtn = document.getElementById("fontScaleBtn");
const demoSceneBtn = document.getElementById("demoSceneBtn");
const languageBtn = document.getElementById("languageBtn");
const confirmDialog = document.getElementById("confirmDialog");

localStorage.removeItem(CURRENT_SESSION_KEY);

let currentTargetAgentId = localStorage.getItem(CURRENT_TARGET_AGENT_KEY) || localStorage.getItem(LEGACY_TARGET_AGENT_KEY) || "claude-main";
const providersStore = createProvidersStore();
const providers = providersStore.getProvidersRef();
const runtimeAvailability = providersStore.getRuntimeAvailabilityRef();
const runtimeInstances = providersStore.getRuntimeInstancesRef();
const hermesProfilesByInstance = providersStore.getHermesProfilesByInstanceRef();
const sessionsStore = createSessionsStore();
const sessions = sessionsStore.getSessionsRef();
const activeSessionIds = sessionsStore.getActiveSessionIdsRef();
let historyEntries = [];
let sessionSeq = 0;
let turnSeq = 0;
let runningSessions = 0;
let isHistoryLoading = true;
let isLaunchDemoScene = false;
let sendAsNewSession = false;
let sendMode = localStorage.getItem(SEND_MODE_KEY) || "enter";
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";
let demoHistoryEntries = [];
const deletedSessionIds = sessionsStore.getDeletedSessionIdsRef();
const stoppedSessionIds = sessionsStore.getStoppedSessionIdsRef();
const flowDetailOpenState = sessionsStore.getFlowDetailOpenStateRef();
const collapsedTurnIds = sessionsStore.getCollapsedTurnIdsRef();
const sessionLatestOnlyState = sessionsStore.getSessionLatestOnlyStateRef();
const sessionListSectionOpenState = {
  active: true,
  archive: true,
};
let scheduledWorkspaceRenderOptions = null;
let scheduledWorkspaceRenderFrame = 0;
let scheduledWorkspaceRenderTimer = 0;
let pendingConfirmAction = null;

function allAgents() {
  const dynamicTargets = runtimeTargets();
  return runtimeInstances.length ? dynamicTargets : providers.flatMap((provider) => provider.agents);
}

function providerById(id) {
  return providersStore.providerById(id);
}

function runtimeInstancesForProvider(providerId) {
  return runtimeInstancesForProviderRaw(runtimeInstances, providerId);
}

function availableRuntimeInstancesForProvider(providerId) {
  return availableRuntimeInstancesForProviderRaw(runtimeInstances, providerId);
}

function runtimeInstanceById(id) {
  return runtimeInstanceByIdRaw(runtimeInstances, id);
}

function providerRuntimeLabel(provider, instance, availableCount) {
  return providerRuntimeLabelRaw(provider, instance, availableCount);
}

function runtimeHostForInstance(instance) {
  return identityRuntimeHostForInstance(instance);
}

function runtimeDefaultsForProvider(providerId, runtimeInstanceId = null) {
  return identityRuntimeDefaultsForProvider(providerId, runtimeInstanceId, runtimeInstances);
}

function inferHermesProfileExecutable(archived, restored) {
  if (restored?.profileExecutable) return restored.profileExecutable;
  if (archived?.hermesProfile?.profileExecutable) return archived.hermesProfile.profileExecutable;
  const alias = archived?.hermesProfile?.profileAlias || restored?.profileAlias;
  if (alias) return alias;
  const agentId = archived?.agentId || restored?.agentId || "";
  const profileId = hermesProfileNameFromAgentId(agentId);
  if (profileId) return profileId === "default" ? null : profileId;
  return null;
}

function targetDisplayName(target) {
  if (!target) return "";
  const provider = providerById(target.providerId);
  const providerName = target.providerName || provider?.name || "";
  if (target.providerId === "hermes" && target.kind === "profile") {
    return `${providerName}${target.runtimeLabel ? ` · ${target.runtimeLabel}` : ""} / ${displayAgentName(target)}`;
  }
  return target.name || providerName || displayAgentName(target);
}

function sessionIdentityTitle(session) {
  return normalizedSessionTitle(session, providers);
}

function targetsForRuntimeInstance(instance) {
  return targetsForRuntimeInstanceRaw(instance, {
    providers,
    runtimeInstances,
    hermesProfilesByInstance,
  });
}

function runtimeTargets() {
  return runtimeTargetsRaw({ providers, runtimeInstances, hermesProfilesByInstance });
}

function normalizeWorkspaceSession(session) {
  return normalizeSessionIdentity(session, {
    providers,
    runtimeInstances,
    runtimeTargets: runtimeTargets(),
  });
}

function archivedSessionsFromHistory(entries) {
  return archivedSessionsFromHistoryRaw(entries, { normalizeSession: normalizeWorkspaceSession });
}

function targetsForProvider(providerId) {
  if (providerId === "trae") return [];
  const instances = runtimeInstancesForProvider(providerId);
  if (!instances.length) {
    return providerById(providerId)?.agents || [];
  }
  return instances.flatMap(targetsForRuntimeInstance);
}

function compactTargetSubtitle(target) {
  if (!target) return "";
  const parts = [];
  if (target.providerId === "hermes") {
    if (target.gateway === "running") parts.push("Gateway 运行中");
    else if (target.gateway) parts.push("Gateway 已停止");
    else if (target.model) parts.push(target.model);
  }
  return parts.filter(Boolean).join(" · ");
}

function providerMetaLabel(provider, targets, instances) {
  if (provider.id === "hermes" && targets.length) {
    return t("provider.profileCount", { count: targets.length });
  }
  if (targets.length) {
    return t("provider.targetCount", { count: targets.length });
  }
  if (instances.length) {
    return t("provider.instanceCount", { count: instances.length });
  }
  return t("provider.targetCount", { count: 0 });
}

function providerRuntimeMiniLabel(instances) {
  const labels = [...new Set(instances.map((instance) => instance.runtimeLabel).filter(Boolean))];
  return labels.join(" / ");
}

function ensureCurrentTargetAgentExists() {
  if (currentTargetAgentId && agentById(currentTargetAgentId)) return;
  if (agentById(DEFAULT_HERMES_AGENT_ID)) {
    saveCurrentTargetAgent(DEFAULT_HERMES_AGENT_ID);
    return;
  }
  if (agentById("claude-win")) {
    saveCurrentTargetAgent("claude-win");
    return;
  }
  const fallbackAgent = allAgents()[0];
  if (fallbackAgent) {
    saveCurrentTargetAgent(fallbackAgent.id);
  } else {
    saveCurrentTargetAgent(null);
  }
}

function agentById(id) {
  if (!id) return null;
  const runtimeTarget = runtimeTargets().find((agent) => agent.id === id);
  if (runtimeTarget) return runtimeTarget;
  const staticAgent = providers.flatMap((provider) => provider.agents).find((agent) => agent.id === id);
  if (!staticAgent) return null;
  const managedByRuntimeProbe = runtimeInstancesForProvider(staticAgent.providerId).length > 0;
  if (managedByRuntimeProbe && !staticAgent.isArchivedAgent && !staticAgent.id.includes("-demo-")) return null;
  return staticAgent;
}

function providerForAgent(agentId) {
  const agent = agentById(agentId);
  return agent ? providerById(agent.providerId) : null;
}

function currentTargetAgent() {
  return agentById(currentTargetAgentId);
}

function displayAgentName(agent) {
  return agent?.nameKey ? t(agent.nameKey) : agent?.name || "";
}

function displayAgentNote(agent) {
  return agent?.noteKey ? t(agent.noteKey) : agent?.note || "";
}

function displayProviderNote(provider) {
  return provider?.noteKey ? t(provider.noteKey, provider.noteParams || {}) : provider?.note || "";
}

function currentTargetProvider() {
  return providerForAgent(currentTargetAgentId);
}

function acpCommandsForProvider(providerId) {
  return acpRuntimeCommands[providerId] || null;
}

function providerState(provider) {
  const instances = runtimeInstancesForProvider(provider.id);
  if (instances.length) {
    const availableCount = instances.filter((instance) => instance.available).length;
    if (availableCount === instances.length) return 1;
    if (availableCount > 0) return 2;
    return 9;
  }
  const availability = runtimeAvailability[provider.id];
  if (availability) {
    return PROVIDER_AVAILABILITY_STATES[availability.summary]?.state ?? 1;
  }
  const states = provider.agents.map((agent) => agent.state);
  return states.includes(3)
    ? 3
    : states.includes(2)
      ? 2
      : states.includes(4)
        ? 4
        : states.includes(5)
          ? 5
          : states.includes(9)
            ? 9
            : states[0] ?? 1;
}

function providerAvailability(providerId) {
  const instances = runtimeInstancesForProvider(providerId);
  if (instances.length) {
    const availableCount = instances.filter((instance) => instance.available).length;
    const summary = availableCount === instances.length
      ? "available"
      : availableCount > 0
        ? "partial"
        : "not_connected";
    return {
      summary,
      configured: instances.some((instance) => instance.configured),
      available: availableCount > 0,
      command: `${availableCount}/${instances.length}`,
      detail: "",
    };
  }
  return runtimeAvailability[providerId] || { summary: "available", configured: true, available: true, command: "" };
}

function canSendToProvider(providerId) {
  if (providerId === "trae") return false;
  if (runtimeInstancesForProvider(providerId).length) {
    return runtimeTargets().some((target) => target.providerId === providerId);
  }
  return providerAvailability(providerId).available;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionStatus(session) {
  return stateNames[session.state] || "UNKNOWN";
}

function sessionLifecycle(session) {
  if (!session) return LIFECYCLE.live;
  if (session.lifecycle) return session.lifecycle;
  return lifecycleFromLegacy({
    runtimeState: session.runtimeState,
    isStopped: stoppedSessionIds.has(session.id),
    isDeleted: deletedSessionIds.has(session.id),
  });
}

function sessionRuntimeState(session) {
  return sessionLifecycle(session);
}

function setSessionLifecycle(session, target) {
  if (!session) return null;
  const from = sessionLifecycle(session);
  let next;
  try {
    next = nextLifecycle(from, target);
  } catch (error) {
    if (error instanceof InvalidLifecycleTransition) {
      console.error(
        `[lifecycle] illegal transition for session ${session.id}: ${from} -> ${target}; ignoring`,
        error,
      );
      return from;
    }
    throw error;
  }
  session.lifecycle = next;
  session.runtimeState = next;
  if (isStoppedLifecycle(next)) {
    if (session.id) stoppedSessionIds.add(session.id);
  } else if (next !== LIFECYCLE.deleted) {
    if (session.id) stoppedSessionIds.delete(session.id);
  }
  if (isDeletedLifecycle(next) && session.id) {
    deletedSessionIds.add(session.id);
  }
  return next;
}

function markSessionDeletedTombstone(sessionId) {
  if (!sessionId) return;
  deletedSessionIds.add(sessionId);
}

function isSessionDeletedTombstone(sessionId) {
  return Boolean(sessionId) && deletedSessionIds.has(sessionId);
}

function isSessionStoppedTombstone(sessionId) {
  return Boolean(sessionId) && stoppedSessionIds.has(sessionId);
}

function canSendToSession(session) {
  return canSendLifecycle(sessionLifecycle(session));
}

function canRestoreSession(session) {
  return canRestoreLifecycle(sessionLifecycle(session));
}

function isArchivedSessionListItem(item) {
  return item.runtimeState === "archived";
}

function isActiveSessionListItem(item) {
  return !isArchivedSessionListItem(item);
}

function isSessionExecuting(session) {
  return executingSessionStates.has(session.state);
}

function formatBackendError(error) {
  const raw = String(error);
  const match = raw.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  if (!match) return raw;
  const [, code, message] = match;
  const labels = {
    RUNTIME_NOT_FOUND: "未找到运行时，请确认对应 ACP adapter 可用",
    PERMISSION_DENIED: "权限被拒绝，请检查授权或目录权限",
    SESSION_NOT_FOUND: "远端 session 不存在或已失效",
    PROTOCOL_PARSE_FAILED: "协议响应解析失败",
    RUNTIME_EXITED: "运行时进程已退出",
    UNKNOWN: "未知运行时错误",
  };
  return `${labels[code] || code}：${message}`;
}

function setAppNotice(message, tone = "muted") {
  if (!appNotice) return;
  appNotice.textContent = message;
  appNotice.classList.toggle("is-busy", tone === "busy");
  appNotice.classList.toggle("is-error", tone === "error");
}

function applyStaticTranslations() {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  applyDataI18n(document);
  document.title = lang === "en-US" ? "LunaAgentOS Console" : "LunaAgentOS 控制台";
  if (providerManagerBtn) providerManagerBtn.textContent = t("common.manage");
  if (languageBtn) languageBtn.textContent = t("topbar.language");
  applyFontScale();
  updateActionLabels();
  updateSendModeLabel();
  updatePromptPlaceholder();
}

function toggleLanguage() {
  toggleLanguagePref();
  applyStaticTranslations();
  renderProviders();
  renderWorkspace();
  renderHistory();
}

function closeConfirmDialog() {
  pendingConfirmAction = null;
  if (!confirmDialog) return;
  confirmDialog.hidden = true;
  confirmDialog.innerHTML = "";
}

function openConfirmDialog({ title, message, confirmLabel = "删除", onConfirm }) {
  if (!confirmDialog) return;
  pendingConfirmAction = onConfirm;
  confirmDialog.hidden = false;
  confirmDialog.innerHTML = `
    <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
      <div class="confirm-dialog-header">
        <span class="confirm-dialog-icon" aria-hidden="true">!</span>
        <h3 id="confirmDialogTitle">${escapeHtml(title)}</h3>
        <button type="button" class="confirm-dialog-close" aria-label="关闭">×</button>
      </div>
      <p class="confirm-dialog-message">${escapeHtml(message)}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="mini-btn confirm-dialog-cancel">取消</button>
        <button type="button" class="mini-btn confirm-dialog-confirm">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;
  confirmDialog.querySelector(".confirm-dialog-close")?.addEventListener("click", closeConfirmDialog);
  confirmDialog.querySelector(".confirm-dialog-cancel")?.addEventListener("click", closeConfirmDialog);
  confirmDialog.querySelector(".confirm-dialog-confirm")?.addEventListener("click", async () => {
    const action = pendingConfirmAction;
    closeConfirmDialog();
    if (action) await action();
  });
}

function updateActionLabels() {
  sendBtn.textContent = isLaunchDemoScene ? t("composer.demo") : t("composer.send");
  sendBtn.disabled = isLaunchDemoScene;
  newSessionToggle.disabled = isLaunchDemoScene;
  newSessionToggle.classList.toggle("is-active", sendAsNewSession);
  newSessionToggle.setAttribute("aria-pressed", String(sendAsNewSession));
  if (demoSceneBtn) demoSceneBtn.textContent = isLaunchDemoScene ? t("topbar.clearDemo") : t("topbar.demo");
}

function updatePromptPlaceholder() {
  const agent = currentTargetAgent();
  promptBox.placeholder = agent
    ? t("composer.placeholderTarget", { target: targetDisplayName(agent) })
    : t("composer.placeholderNoTarget");
}

function scheduleWorkspaceRender(options = {}, delayMs = 0) {
  scheduledWorkspaceRenderOptions = {
    ...(scheduledWorkspaceRenderOptions || {}),
    ...options,
  };
  if (scheduledWorkspaceRenderFrame || scheduledWorkspaceRenderTimer) return;
  const requestRender = () => {
    scheduledWorkspaceRenderTimer = 0;
    scheduledWorkspaceRenderFrame = requestAnimationFrame(() => {
      const nextOptions = scheduledWorkspaceRenderOptions || {};
      scheduledWorkspaceRenderFrame = 0;
      scheduledWorkspaceRenderOptions = null;
      renderWorkspace(nextOptions);
    });
  };
  if (delayMs > 0) {
    scheduledWorkspaceRenderTimer = window.setTimeout(requestRender, delayMs);
    return;
  }
  scheduledWorkspaceRenderFrame = requestAnimationFrame(() => {
    const nextOptions = scheduledWorkspaceRenderOptions || {};
    scheduledWorkspaceRenderFrame = 0;
    scheduledWorkspaceRenderOptions = null;
    renderWorkspace(nextOptions);
  });
}

function saveCurrentTargetAgent(agentId) {
  currentTargetAgentId = agentId;
  if (agentId) {
    localStorage.setItem(CURRENT_TARGET_AGENT_KEY, agentId);
  } else {
    localStorage.removeItem(CURRENT_TARGET_AGENT_KEY);
  }
  localStorage.removeItem(LEGACY_TARGET_AGENT_KEY);
}

function saveCurrentSession(sessionId) {
  sessionsStore.setCurrentSessionId(sessionId || null);
  localStorage.removeItem(CURRENT_SESSION_KEY);
}

function markSessionActive(sessionId) {
  sessionsStore.markActive(sessionId);
}

function markSessionInactive(sessionId) {
  sessionsStore.markInactive(sessionId);
}

function clearCurrentSessionIf(sessionId) {
  sessionsStore.clearCurrentSessionIf(sessionId);
  localStorage.removeItem(CURRENT_SESSION_KEY);
}

function currentSession() {
  return sessionsStore.getSession(sessionsStore.getCurrentSessionId());
}

function currentFontScaleOption() {
  return FONT_SCALE_OPTIONS.find((item) => item.id === fontScaleId) || FONT_SCALE_OPTIONS[1];
}

function applyFontScale() {
  const option = currentFontScaleOption();
  document.documentElement.style.setProperty("--ui-scale", String(option.scale));
  if (fontScaleBtn) fontScaleBtn.textContent = t(option.labelKey);
}

function cycleFontScale() {
  const index = FONT_SCALE_OPTIONS.findIndex((item) => item.id === fontScaleId);
  const next = FONT_SCALE_OPTIONS[(index + 1) % FONT_SCALE_OPTIONS.length];
  fontScaleId = next.id;
  localStorage.setItem(FONT_SCALE_KEY, fontScaleId);
  applyFontScale();
}

function updateSendModeLabel() {
  if (!sendModeBtn) return;
  sendModeBtn.textContent = sendMode === "enter" ? t("composer.enterSend") : t("composer.ctrlEnter");
}

function toggleSendMode() {
  const index = SEND_MODE_OPTIONS.indexOf(sendMode);
  sendMode = SEND_MODE_OPTIONS[(index + 1) % SEND_MODE_OPTIONS.length];
  localStorage.setItem(SEND_MODE_KEY, sendMode);
  updateSendModeLabel();
}

async function openProviderManagerPrompt() {
  try {
    const current = await invoke("load_runtime_config");
    const claudeCommand = window.prompt("Claude adapter command（留空使用默认 npx/npx.cmd）", current?.claudeCommand || "");
    if (claudeCommand === null) return;
    const claudeArgs = window.prompt("Claude adapter args（空格分隔；留空使用默认 -y @agentclientprotocol/claude-agent-acp）", (current?.claudeArgs || []).join(" "));
    if (claudeArgs === null) return;
    const hermesHost = window.prompt("Hermes host：wsl 或 native", current?.hermesHost || "wsl");
    if (hermesHost === null) return;
    const hermesCommand = window.prompt("Hermes executable/profile alias（留空使用 hermes 或已探测 profile）", current?.hermesCommand || "");
    if (hermesCommand === null) return;
    await invoke("save_runtime_config", {
      config: {
        ...current,
        claudeCommand: claudeCommand.trim() || null,
        claudeArgs: claudeArgs.trim() ? claudeArgs.trim().split(/\s+/) : [],
        hermesHost: hermesHost.trim() || "wsl",
        hermesCommand: hermesCommand.trim() || null,
      },
    });
    setAppNotice("Runtime 配置已保存。后续新建/恢复 ACP 会话会使用该配置。");
    await refreshRuntimeProbe();
  } catch (error) {
    console.error(error);
    setAppNotice(`Runtime 配置读取或保存失败：${formatBackendError(error)}`, "error");
  }
}

async function openProviderManager(providerId = currentTargetProvider()?.id || "claude") {
  if (!confirmDialog) {
    await openProviderManagerPrompt();
    return;
  }
  try {
    const selectedProviderId = providerId === "hermes" ? "hermes" : "claude";
    const selectedAvailability = providerAvailability(selectedProviderId);
    const selectedState = providerAvailabilityLabel(selectedAvailability.summary);
    const selectedStateClass = stateClasses[PROVIDER_AVAILABILITY_STATES[selectedAvailability.summary]?.state] || "state-idle";
    const isClaude = selectedProviderId === "claude";
    const title = isClaude ? t("runtimeConfig.claudeTitle") : t("runtimeConfig.hermesTitle");
    const instances = runtimeInstancesForProvider(selectedProviderId);
    const instanceMarkup = instances.length
      ? instances.map((instance) => {
        const state = instance.available ? 1 : 9;
        return `
          <article class="connection-instance-card">
            <div class="connection-instance-top">
              <strong>${escapeHtml(instance.runtimeLabel || title)}</strong>
              <span class="state-pill ${stateClasses[state] || "state-idle"}">${instance.available ? t("provider.available") : t("provider.notConnected")}</span>
            </div>
            <p>${escapeHtml(instance.summary || "")}</p>
            ${instance.detail ? `<small>${escapeHtml(instance.detail)}</small>` : ""}
            ${instance.version ? `<small>${escapeHtml(instance.version)}</small>` : ""}
          </article>
        `;
      }).join("")
      : `<p class="connection-empty">${t("connection.none")}</p>`;
    confirmDialog.hidden = false;
    confirmDialog.innerHTML = `
      <form class="confirm-dialog runtime-config-dialog connection-dialog" role="dialog" aria-modal="true" aria-labelledby="runtimeConfigTitle">
        <div class="confirm-dialog-header">
          <span class="runtime-config-icon" aria-hidden="true">●</span>
          <div>
            <h3 id="runtimeConfigTitle">${t("connection.title")} · ${title}</h3>
            <p class="runtime-config-subtitle">${t("connection.subtitle")}</p>
          </div>
          <button type="button" class="confirm-dialog-close runtime-config-close" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="runtime-config-body">
          <aside class="runtime-config-status-card">
            <span class="runtime-config-kicker">${selectedProviderId}</span>
            <strong>${title}</strong>
            <span class="state-pill ${selectedStateClass}">${selectedState}</span>
            <span>${escapeHtml(runtimeConnectionNote(providerById(selectedProviderId) || { id: selectedProviderId, name: title }, instances))}</span>
          </aside>
          <section class="runtime-config-section">
            <h4>${t("connection.detected")}</h4>
            <div class="connection-instance-list">${instanceMarkup}</div>
          </section>
        </div>
        <div class="confirm-dialog-actions runtime-config-actions">
          <button type="button" class="confirm-dialog-cancel runtime-config-close">${t("common.close")}</button>
          <button type="button" class="mini-btn ghost-btn runtime-config-legacy">${t("runtimeConfig.legacyPrompt")}</button>
          <button type="submit" class="primary runtime-config-save">${t("connection.recheck")}</button>
        </div>
      </form>
    `;
    confirmDialog.querySelectorAll(".runtime-config-close").forEach((button) => {
      button.addEventListener("click", closeConfirmDialog);
    });
    confirmDialog.querySelector(".runtime-config-legacy")?.addEventListener("click", async () => {
      closeConfirmDialog();
      await openProviderManagerPrompt();
    });
    confirmDialog.querySelector(".runtime-config-dialog")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const saveButton = event.currentTarget.querySelector(".runtime-config-save");
      saveButton.disabled = true;
      setAppNotice("正在重新检查连接...", "busy");
      try {
        await refreshRuntimeProbe();
        if (selectedProviderId === "hermes") await loadHermesProfiles();
        closeConfirmDialog();
        setAppNotice("连接检查已完成。");
      } catch (error) {
        console.error(error);
        saveButton.disabled = false;
        setAppNotice(t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
      }
    });
  } catch (error) {
    console.error(error);
    setAppNotice(t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
  }
}

function showProviderAgents(provider) {
  const names = provider.agents.map((agent) => displayAgentName(agent)).join("、");
  setAppNotice(`${provider.name} 当前已登记的 Agent：${names}。`);
}

async function refreshRuntimeProbe() {
  try {
    const result = await invoke("runtime_probe");
    providersStore.batch(() => {
      providersStore.patchRuntimeAvailability(
        Object.fromEntries((result?.providers || []).map((item) => [item.providerId, item])),
      );
      providersStore.replaceRuntimeInstances(Array.isArray(result?.instances) ? result.instances : []);
      providersStore.pruneHermesProfilesByInstanceIds(
        runtimeInstances.filter((instance) => instance.available).map((instance) => instance.id),
      );
    });
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspaceStatus();
    return result;
  } catch (error) {
    console.error(error);
    setAppNotice(`Runtime 探测失败：${formatBackendError(error)}`, "error");
    return null;
  }
}

function latestActiveSessionForAgent(agentId) {
  return [...sessions]
    .filter((session) => session.agentId === agentId && activeSessionIds.has(session.id) && canSendToSession(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

function setCurrentTargetAgent(agentId) {
  saveCurrentTargetAgent(agentId);
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  updatePromptPlaceholder();
  if (agent && provider) {
    renderWorkspaceStatus();
    setAppNotice(`已切换到 ${targetDisplayName(agent)}。`);
  }
  renderProviders();
  renderWorkspace();
}

function runtimeConnectionNote(provider, instances) {
  if (provider.id === "trae") return displayProviderNote(provider);
  if (!instances.length) {
    return provider.id === "hermes" ? t("provider.noHermesRuntime") : t("provider.noRuntime");
  }
  const available = instances.filter((instance) => instance.available);
  if (!available.length) return provider.id === "hermes" ? t("provider.noHermesRuntime") : t("provider.noRuntime");
  return available
    .map((instance) => instance.runtimeLabel || provider.name)
    .join(" / ");
}

function renderRuntimeTarget(target) {
  const selected = target.id === currentTargetAgentId;
  const subtitle = compactTargetSubtitle(target) || target.subtitle || "";
  const name = displayAgentName(target);
  const shouldShowRuntimeLabel = target.runtimeLabel && !name.includes(target.runtimeLabel);
  return `
    <div class="agent-entry ${selected ? "is-main-agent" : "is-selectable"}" data-agent-id="${target.id}">
      <div class="agent-entry-top">
        <strong>${escapeHtml(name)}</strong>
        ${shouldShowRuntimeLabel ? `<span class="target-runtime-label">${escapeHtml(target.runtimeLabel)}</span>` : ""}
      </div>
      ${subtitle ? `<div class="agent-entry-sub">${escapeHtml(subtitle)}</div>` : ""}
    </div>
  `;
}

function renderProviders() {
  ensureCurrentTargetAgentExists();
  agentList.innerHTML = "";

  providers.forEach((provider) => {
    const group = document.createElement("section");
    group.className = "provider-group";
    const availability = providerAvailability(provider.id);
    const availabilityLabel = providerAvailabilityLabel(availability.summary);
    const instances = runtimeInstancesForProvider(provider.id);
    const targets = targetsForProvider(provider.id);
    const metaLabel = providerMetaLabel(provider, targets, instances);
    const runtimeMiniLabel = providerRuntimeMiniLabel(instances);
    const targetMarkup = targets.map(renderRuntimeTarget).join("");
    const hasAvailableRuntime = instances.some((instance) => instance.available);
    const emptyLabel = hasAvailableRuntime
      ? t("provider.noTargets")
      : provider.id === "hermes"
        ? t("provider.noHermesRuntime")
        : t("provider.noRuntime");
    const statusClass = availability.available
      ? (availability.summary === "partial" ? "is-partial" : "is-available")
      : provider.id === "trae"
        ? "is-planned"
        : "is-unavailable";

    group.innerHTML = `
      <div class="provider-header">
        <div class="provider-heading">
          <div class="provider-title-row">
            <strong>${provider.name}</strong>
            <span class="provider-status-dot ${statusClass}" title="${escapeHtml(availabilityLabel)}" aria-label="${escapeHtml(availabilityLabel)}"></span>
          </div>
          <div class="provider-meta-row">
            <span class="provider-count-badge">${escapeHtml(metaLabel)}</span>
            ${runtimeMiniLabel ? `<span class="provider-runtime-mini">${escapeHtml(runtimeMiniLabel)}</span>` : ""}
          </div>
        </div>
        <button type="button" class="mini-btn ghost-btn provider-manage-btn provider-connection-icon-btn" data-provider-id="${provider.id}" title="${t("common.manage")}" aria-label="${t("common.manage")}">⚙</button>
      </div>
      <div class="provider-targets">
        ${targetMarkup || `<div class="runtime-instance-empty">${emptyLabel}</div>`}
      </div>
    `;

    agentList.appendChild(group);
  });

  agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProviderManager(button.dataset.providerId);
    });
  });

  agentList.querySelectorAll(".agent-entry.is-selectable").forEach((entry) => {
    entry.addEventListener("click", () => {
      const agentId = entry.dataset.agentId;
      if (!agentId) return;
      setCurrentTargetAgent(agentId);
    });
  });

}

function applyHermesProfiles(profiles) {
  const hermesProvider = providerById("hermes");
  if (!hermesProvider || !Array.isArray(profiles) || !profiles.length) return;
  providersStore.batch(() => {
    providersStore.setProviderAgents("hermes", profiles.map((profile) => ({
      id: profile.id,
      providerId: "hermes",
      name: profile.displayName,
      subtitle: profile.subtitle || "WSL Profile",
      note: profile.note || "Hermes profile",
      state: typeof profile.state === "number" ? profile.state : 1,
      profileName: profile.profileName,
      model: profile.model,
      gateway: profile.gateway,
      alias: profile.alias,
      profileAlias: profile.alias,
      profileExecutable: profile.alias || null,
      path: profile.path,
      profilePath: profile.path,
      skillCount: profile.skillCount,
      hasEnv: profile.hasEnv,
      hasSoul: profile.hasSoul,
      isDefault: Boolean(profile.isDefault),
    })));
    providersStore.setProviderNote("hermes", {
      note: null,
      noteKey: "provider.hermes.loadedNote",
      noteParams: { count: profiles.length },
    });
  });
  if (isLaunchDemoScene) {
    ensureLaunchDemoHermesAgent();
    currentTargetAgentId = "hermes-demo-ailearning";
  }
  ensureCurrentTargetAgentExists();
  renderProviders();
  renderWorkspace();
}

function applyHermesProfilesForInstance(runtimeInstanceId, profiles) {
  providersStore.batch(() => {
    providersStore.setHermesProfilesForInstance(runtimeInstanceId, profiles);
    const count = providersStore.totalHermesProfileCount();
    if (providerById("hermes") && count > 0) {
      providersStore.setProviderNote("hermes", {
        note: null,
        noteKey: "provider.hermes.loadedNote",
        noteParams: { count },
      });
    }
  });
}

async function loadHermesProfiles(runtimeInstanceIds = null) {
  const instances = (runtimeInstanceIds || availableRuntimeInstancesForProvider("hermes").map((instance) => instance.id))
    .map(runtimeInstanceById)
    .filter(Boolean)
    .filter((instance) => instance.available);
  if (!instances.length) return;
  try {
    let loaded = 0;
    for (const instance of instances) {
      const profiles = await invoke("runtime_hermes_profiles", { runtimeInstanceId: instance.id });
      applyHermesProfilesForInstance(instance.id, profiles);
      loaded += Array.isArray(profiles) ? profiles.length : 0;
    }
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspace();
    if (!loaded) setAppNotice("未探测到可用的 Hermes profile。");
  } catch (error) {
    console.error(error);
    setAppNotice(`读取 Hermes profile 失败：${formatBackendError(error)}`, "error");
  }
}

function hermesProfileMetaFromAgent(agent) {
  if (!agent || agent.providerId !== "hermes") return null;
  return {
    profileName: agent.profileName || null,
    profileAlias: agent.profileAlias || agent.alias || null,
    profileExecutable: agent.profileExecutable || agent.alias || null,
    profilePath: agent.profilePath || agent.path || null,
    profileModel: agent.model || null,
    gateway: agent.gateway || null,
    skillCount: agent.skillCount ?? null,
    hasSoul: Boolean(agent.hasSoul),
  };
}

function hermesProfileMetaFromSession(session) {
  if (!session || session.providerId !== "hermes") return null;
  return {
    profileName: session.profileName || null,
    profileAlias: session.profileAlias || null,
    profileExecutable: session.profileExecutable || null,
    profilePath: session.profilePath || null,
    profileModel: session.profileModel || null,
    gateway: session.gateway || null,
    skillCount: session.skillCount ?? null,
    hasSoul: Boolean(session.hasSoul),
  };
}

function hermesProfileMetaFromArchived(archived) {
  return archived?.hermesProfile || archived?.turns?.find((turn) => turn.meta?.hermesProfile)?.meta?.hermesProfile || null;
}

function createSession(firstTask) {
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  if (!agent || !provider) return null;

  const hermesProfile = hermesProfileMetaFromAgent(agent);
  sessionSeq += 1;
  const targetName = targetDisplayName(agent);
  const session = {
    id: `session-${Date.now()}-${sessionSeq}`,
    providerId: provider.id,
    providerName: provider.name,
    agentId: agent.id,
    agentName: targetName,
    targetId: agent.id,
    targetName,
    runtimeInstanceId: agent.runtimeInstanceId || null,
    runtimeLabel: agent.runtimeLabel || null,
    runtimeHost: agent.runtimeHost || null,
    runtimeCommand: agent.runtimeCommand || null,
    task: firstTask,
    state: 2,
    lifecycle: LIFECYCLE.live,
    runtimeState: LIFECYCLE.live,
    turns: [],
    createdAt: new Date().toISOString(),
    fullscreen: false,
    acpStartupNoticeShown: false,
    profileName: hermesProfile?.profileName || null,
    profileAlias: hermesProfile?.profileAlias || null,
    profileExecutable: hermesProfile?.profileExecutable || null,
    profilePath: hermesProfile?.profilePath || null,
    profileModel: hermesProfile?.profileModel || null,
    gateway: hermesProfile?.gateway || null,
    skillCount: hermesProfile?.skillCount ?? null,
    hasSoul: hermesProfile?.hasSoul || false,
  };
  Object.assign(session, normalizeWorkspaceSession(session));
  sessionsStore.upsertHead(session);
  markSessionActive(session.id);
  renderWorkspace();
  renderHistory();
  return session;
}

function createTurn(session, task) {
  turnSeq += 1;
  const hermesProfile = hermesProfileMetaFromSession(session);
  const turn = {
    id: `turn-${Date.now()}-${turnSeq}`,
    task,
    state: 0,
    thoughts: [],
    outputs: [],
    finalResponse: "正在等待运行时返回内容...",
    logs: ["消息已进入当前会话，等待运行时返回内容。"],
    createdAt: new Date().toISOString(),
    meta: hermesProfile ? { hermesProfile } : {},
  };
  session.task = task;
  session.state = 2;
  session.activeTurnId = turn.id;
  session.turns.push(turn);
  renderWorkspace();
  return turn;
}

function prependHermesStartupNoticeIfNeeded(session, turn) {
  if (session.providerId !== "hermes") return;
  if (session.acpStartupNoticeShown || session.acpSessionId) return;
  const profileName = session.profileName || session.agentName;
  const message = `Hermes profile ${profileName} ${HERMES_ACP_STARTUP_NOTICE}`;
  session.acpStartupNoticeShown = true;
  if (!turn.logs.includes(message)) {
    turn.logs = [message, ...turn.logs];
  }
}



function ensureLaunchDemoHermesAgent() {
  const hermesProvider = providerById("hermes");
  if (!hermesProvider) return null;
  const existing = agentById("hermes-demo-ailearning");
  if (existing) return existing;
  const agent = {
    id: "hermes-demo-ailearning",
    providerId: "hermes",
    name: "ailearning",
    subtitle: "WSL Profile · Gateway",
    note: "用于展示 Hermes ACP 过程流的演示 profile。",
    state: 3,
    profileName: "ailearning",
    model: "MiniMax M2",
    gateway: "Gateway API",
    alias: "ailearning",
    profileAlias: "ailearning",
    profileExecutable: "ailearning",
    skillCount: 4,
    hasSoul: true,
  };
  providersStore.appendProviderAgent("hermes", agent);
  return agent;
}

function removeLaunchDemoHermesAgent() {
  const hermesProvider = providerById("hermes");
  if (!hermesProvider) return;
  providersStore.removeProviderAgent("hermes", "hermes-demo-ailearning");
}



function activateLaunchDemoScene() {
  ensureLaunchDemoHermesAgent();
  isLaunchDemoScene = true;
  isHistoryLoading = false;
  demoHistoryEntries = buildLaunchDemoHistoryEntries(HISTORY_SCHEMA_VERSION);
  sessionsStore.batch(() => {
    sessionsStore.replaceSessions([
      ...buildLaunchDemoSessions(),
      ...sessions.filter((session) => !session.id.startsWith("demo-session-")),
    ]);
    sessionsStore.setCurrentSessionId("demo-session-hermes-live");
    sessionsStore.markActive("demo-session-hermes-live");
    sessionsStore.markActive("demo-session-claude-review");
  });
  currentTargetAgentId = "hermes-demo-ailearning";
  ["demo-turn-hermes-live:thoughts", "demo-turn-hermes-live:logs", "demo-turn-claude-review:logs"].forEach((key) => {
    flowDetailOpenState.set(key, true);
  });
  document.body.classList.add("is-launch-demo");
  renderProviders();
  renderWorkspace();
  renderHistory();
  updateActionLabels();
  setAppNotice("已载入 GitHub 首发演示场景：Claude + Hermes + 活跃会话/归档会话。");
}


function leaveLaunchDemoScene() {
  isLaunchDemoScene = false;
  demoHistoryEntries = [];
  sessionsStore.batch(() => {
    sessionsStore.filterSessions((session) => !isDemoSession(session));
    sessionsStore.replaceActiveSessionIds(
      [...activeSessionIds].filter((sessionId) => !sessionId.startsWith("demo-session-")),
    );
    if (sessionsStore.getCurrentSessionId()?.startsWith("demo-session-")) {
      sessionsStore.setCurrentSessionId(null);
    }
  });
  if (currentTargetAgentId === "hermes-demo-ailearning") currentTargetAgentId = "claude-main";
  removeLaunchDemoHermesAgent();
  ensureCurrentTargetAgentExists();
  document.body.classList.remove("is-launch-demo");
  renderProviders();
  renderWorkspace();
  renderHistory();
  updateActionLabels();
  setAppNotice("已清除首发演示场景，恢复真实工作台。");
}

function getOrCreateActiveSession(task, forceNew = false) {
  const agent = currentTargetAgent();
  if (!agent) return null;
  const existing = !forceNew ? currentSession() : null;
  if (existing && existing.agentId !== agent.id) return createSession(task);
  if (existing && !activeSessionIds.has(existing.id)) return createSession(task);
  return existing && canSendToSession(existing) ? existing : createSession(task);
}

function updateTurnFromEvents(sessionId, turnId, events) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  const turn = session.turns.find((item) => item.id === turnId);
  if (!turn) return null;

  applyEventsToTurn(session, turn, events);
  renderWorkspace();
  renderHistory();
  return turn;
}

function appendStreamEventToTurn(sessionId, event) {
  if (isSessionDeletedTombstone(sessionId) || isSessionStoppedTombstone(sessionId)) return;
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const turn = session.turns.find((item) => item.id === session.activeTurnId) || session.turns.at(-1);
  if (!turn) return;

  applyStreamEventToTurn(session, turn, event);
  scheduleSessionCardRender(session.id);
}

function appendErrorToTurn(sessionId, turnId, message) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const turn = session.turns.find((item) => item.id === turnId);
  if (!turn) return;
  turn.state = 9;
  turn.logs = [message, ...turn.logs];
  session.state = 9;
  if (session.acpSessionId) {
    setSessionLifecycle(session, LIFECYCLE.resume_failed);
    markSessionInactive(session.id);
  }
  renderWorkspace();
  renderHistory();
  setAppNotice(`会话 ${session.agentName} 执行失败：${message}`, "error");
}

function appendRuntimeLogToSession(session, message, state = null) {
  const turn = session?.turns?.at(-1);
  if (!turn || !message) return;
  if (!turn.logs.includes(message)) {
    turn.logs = [message, ...turn.logs];
  }
  if (typeof state === "number") {
    turn.state = state;
    session.state = state;
  }
  flowDetailOpenState.set(`${turn.id}:logs`, true);
}

function updateWorkspaceEmptyCopy() {
  const restorableCount = countRestorableActiveHistoryItems();
  const titleEl = workspaceEmpty.querySelector("strong");
  const textEl = workspaceEmpty.querySelector("p");
  if (!titleEl || !textEl) return;
  if (restorableCount > 0) {
    titleEl.textContent = t("workspace.emptyRestoreTitle");
    textEl.textContent = t("workspace.emptyRestoreText");
    titleEl.dataset.i18n = "workspace.emptyRestoreTitle";
    textEl.dataset.i18n = "workspace.emptyRestoreText";
  } else {
    titleEl.textContent = t("workspace.emptyTitle");
    textEl.textContent = t("workspace.emptyText");
    titleEl.dataset.i18n = "workspace.emptyTitle";
    textEl.dataset.i18n = "workspace.emptyText";
  }
}

function countRestorableActiveHistoryItems() {
  const liveIds = new Set(sessions.map((session) => session.id));
  return archivedSessionsFromHistory(readableHistoryEntries())
    .filter((item) => !liveIds.has(item.id))
    .filter((item) => (item.runtimeState || "archived") !== "archived")
    .length;
}

function renderWorkspaceStatus() {
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  const countedSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
  const liveCount = countedSessions.filter((session) => sessionRuntimeState(session) === "live").length;
  if (!agent || !provider) {
    workspaceStatus.textContent = t("composer.placeholderNoTarget");
    return;
  }
  const statusSession = currentSession()
    || latestActiveSessionForAgent(agent.id)
    || countedSessions
      .filter((session) => session.agentId === agent.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    || null;
  const statusState = statusSession?.state ?? agent.state ?? 1;
  const availability = providerAvailability(provider.id);
  const availabilityLabel = providerAvailabilityLabel(availability.summary);
  workspaceStatus.innerHTML = `
    <strong class="workspace-status-target">${escapeHtml(targetDisplayName(agent))}</strong>
    <span class="workspace-status-separator">·</span>
    <span class="state-pill workspace-state-pill ${stateClasses[statusState] || "state-idle"}">${escapeHtml(stateDisplayLabel(statusState))}</span>
    <span class="workspace-runtime-count">${escapeHtml(availabilityLabel)}</span>
    ${liveCount > 0 ? `<span class="workspace-runtime-count">ACP × ${liveCount}</span>` : ""}
  `;
}





function sessionCardStats(session) {
  const thoughtCount = session.turns.reduce((count, turn) => count + turn.thoughts.length, 0);
  const logCount = session.turns.reduce((count, turn) => count + turn.logs.length, 0);
  const outputCount = session.turns.filter((turn) => turnResponseText(turn)).length;
  return [
    thoughtCount ? { key: "thoughts", label: t("session.thoughts", { count: thoughtCount }) } : null,
    logCount ? { key: "logs", label: t("session.logs", { count: logCount }) } : null,
    outputCount ? { key: "responses", label: t("session.responses", { count: outputCount }) } : null,
  ].filter(Boolean);
}

function isSessionLatestOnly(session) {
  return sessionLatestOnlyState.get(session.id) ?? false;
}

function toggleSessionLatestOnly(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  sessionLatestOnlyState.set(sessionId, !isSessionLatestOnly(session));
  renderWorkspace();
}

function turnResponseText(turn) {
  return turn.finalResponse || turn.outputs.join("\n\n");
}

function shouldPreferPlainResponseView(text, phase = "final") {
  const value = String(text || "");
  if (!value.trim()) return false;
  if (phase === "streaming") return false;
  if (hasMarkdownTable(normalizeLooseMarkdownTables(normalizeRuntimeMarkdown(value)))) return false;
  const lines = value.split(/\r?\n/);
  const pipeCount = (value.match(/\|/g) || []).length;
  const pipeLines = lines.filter((line) => (line.match(/\|/g) || []).length >= 3).length;
  const densePipeLines = lines.filter((line) => (line.match(/\|/g) || []).length >= 6).length;
  const longLines = lines.filter((line) => line.length > 180).length;
  const hasReportHeading = /part\s*\d+|热榜|财务|成交额|涨跌幅|MA\d+|RSI|MACD/i.test(value);
  return densePipeLines >= 1
    || pipeLines >= 2
    || longLines >= 1
    || (pipeCount >= 4 && hasReportHeading)
    || (value.length > 1200 && pipeCount >= 2);
}

function splitAssistantResponseForDisplay(text, phase = "final") {
  const value = String(text || "");
  if (phase === "streaming") return { prelude: "", body: value };
  const match = value.match(/#{1,6}\s*Part\s*\d+[^\n]{0,80}/i);
  if (!match || match.index == null || match.index < 120) return { prelude: "", body: value };
  const prelude = value.slice(0, match.index).replace(/[-\s]+$/g, "").trim();
  const body = value.slice(match.index).trim();
  const looksLikeProcess = /我|需要|确认|检查|获取|查询|开始|写|todo|Now|Let me|I need/i.test(prelude);
  if (!prelude || !body || !looksLikeProcess) return { prelude: "", body: value };
  return { prelude, body };
}

function renderResponsePrelude(prelude) {
  if (!prelude) return "";
  return `
    <details class="response-prelude-detail">
      <summary>${t("report.prelude")}</summary>
      <div class="terminal-pre">${escapeHtml(prelude)}</div>
    </details>
  `;
}

function renderAssistantResponse(text, phase = "final") {
  const source = phase === "streaming" ? closeStreamingMarkdown(text) : text;
  const display = splitAssistantResponseForDisplay(source, phase);
  const preludeHtml = renderResponsePrelude(display.prelude);
  if (!shouldPreferPlainResponseView(display.body, phase)) {
    return `
      <div class="runtime-output-view ${phase === "streaming" ? "is-streaming" : "is-final"}">
        ${preludeHtml}
        <div class="rich-text">${renderRichText(display.body)}</div>
      </div>
    `;
  }
  return `
    ${preludeHtml}
    <div class="plain-report-view">
      <div class="plain-report-toolbar">
        <span>${t("report.rawView")}</span>
        <span class="caption">${t("report.rawHint")}</span>
      </div>
      <pre>${escapeHtml(display.body)}</pre>
    </div>
    <details class="rendered-report-detail">
      <summary>${t("report.renderedView")}</summary>
      <div class="rich-text">${renderRichText(display.body)}</div>
    </details>
  `;
}

function sessionTranscriptText(session) {
  return session.turns.map((turn, index) => turnTranscriptText(turn, index)).join("\n\n---\n\n");
}

function turnTranscriptText(turn, index) {
  const parts = [
    `# 第 ${index + 1} 轮`,
    `user:\n${turn.task}`,
  ];
  if (turn.thoughts.length) parts.push(`思考流:\n${turn.thoughts.join("\n\n")}`);
  const response = turnResponseText(turn);
  if (response) parts.push(`assistant:\n${response}`);
  if (turn.logs.length) parts.push(`运行流:\n${turn.logs.join("\n")}`);
  return parts.join("\n\n");
}

function flowDetailEntriesForSession(session) {
  return session.turns.flatMap((turn) => {
    const defaultOpen = turn.state === 2;
    return [
      turn.thoughts.length ? { key: `${turn.id}:thoughts`, defaultOpen } : null,
      turn.logs.length ? { key: `${turn.id}:logs`, defaultOpen } : null,
    ].filter(Boolean);
  });
}

function detailKeysForSession(session) {
  return flowDetailEntriesForSession(session).map((entry) => entry.key);
}

function setSessionFlowDetails(sessionId, open) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  detailKeysForSession(session).forEach((key) => flowDetailOpenState.set(key, open));
  renderWorkspace();
}

function areSessionFlowDetailsOpen(session) {
  const entries = flowDetailEntriesForSession(session);
  return entries.length > 0 && entries.every(({ key, defaultOpen }) => flowDetailOpenState.get(key) ?? defaultOpen);
}

function detailOpenAttribute(key, defaultOpen) {
  const stored = flowDetailOpenState.get(key);
  return (stored ?? defaultOpen) ? "open" : "";
}

function renderTurnCollapseIcon(collapsed) {
  const points = collapsed ? "6 9 12 15 18 9" : "6 15 12 9 18 15";
  return `
    <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5h16"></path>
      <path d="M4 19h16"></path>
      <path d="M${points}"></path>
    </svg>
  `;
}

function renderSessionActionIcon(name) {
  const icons = {
    dismiss: `<path d="M12 4v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 20h14"></path>`,
    archive: `<path d="M4 7h16"></path><path d="M6 7l1.2 13h9.6L18 7"></path><path d="M9 11h6"></path>`,
    stop: `<rect x="7" y="7" width="10" height="10" rx="1.5"></rect>`,
    delete: `<path d="M4 7h16"></path><path d="M10 11v5"></path><path d="M14 11v5"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path>`,
    copy: `<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>`,
    latest: `<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2"></path><path d="M12 19v2"></path><path d="M3 12h2"></path><path d="M19 12h2"></path>`,
    all: `<path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path>`,
    collapse: `<path d="M7 15l5-5 5 5"></path><path d="M5 20h14"></path>`,
    expand: `<path d="M7 9l5 5 5-5"></path><path d="M5 4h14"></path>`,
    latestScroll: `<path d="M12 4v13"></path><path d="m7 12 5 5 5-5"></path><path d="M5 20h14"></path>`,
    fullscreen: `<path d="M8 4H4v4"></path><path d="M16 4h4v4"></path><path d="M20 16v4h-4"></path><path d="M4 16v4h4"></path>`,
    fullscreenExit: `<path d="M9 4v5H4"></path><path d="M15 4v5h5"></path><path d="M20 15h-5v5"></path><path d="M4 15h5v5"></path>`,
  };
  return `
    <svg class="session-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${icons[name] || icons.copy}
    </svg>
  `;
}

function turnCollapsedSummary(turn) {
  const response = turnResponseText(turn);
  const source = [turn.task, response].filter(Boolean).join(" · ");
  const compact = source.replace(/\s+/g, " ").trim();
  if (!compact) return "本轮内容已折叠。";
  return compact.length > 108 ? `${compact.slice(0, 108)}...` : compact;
}

function toggleTurnCollapsed(turnId) {
  if (!turnId) return;
  if (collapsedTurnIds.has(turnId)) collapsedTurnIds.delete(turnId);
  else collapsedTurnIds.add(turnId);
  renderWorkspace();
}

function areSessionTurnsCollapsed(session) {
  return session.turns.length > 0 && session.turns.every((turn) => collapsedTurnIds.has(turn.id));
}

function toggleSessionTurnsCollapsed(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const shouldExpand = areSessionTurnsCollapsed(session);
  session.turns.forEach((turn) => {
    if (shouldExpand) collapsedTurnIds.delete(turn.id);
    else collapsedTurnIds.add(turn.id);
  });
  renderWorkspace();
  setAppNotice(shouldExpand ? "已展开当前会话全部轮次。" : "已折叠当前会话全部轮次。");
}

function findTurnById(turnId) {
  for (const session of sessions) {
    const turnIndex = session.turns.findIndex((item) => item.id === turnId);
    const turn = session.turns[turnIndex];
    if (turn) return { session, turn, turnIndex };
  }
  return null;
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn(error);
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function renderTurn(turn, index) {
  const streaming = executingSessionStates.has(turn.state);
  const waiting = streaming && !turn.finalResponse;
  const rawResponseText = turnResponseText(turn);
  const responseText = rawResponseText || t("turn.waiting");
  const thoughtDetailKey = `${turn.id}:thoughts`;
  const logDetailKey = `${turn.id}:logs`;
  const collapsed = collapsedTurnIds.has(turn.id);
  const turnToggleLabel = collapsed ? t("action.expandTurn") : t("action.collapseTurn");
  return `
    <section class="turn-block ${collapsed ? "is-collapsed" : ""}" data-turn-id="${escapeHtml(turn.id)}">
      <div class="turn-header">
        <div class="turn-title">
          <button type="button" class="mini-btn ghost-btn turn-collapse-btn ${collapsed ? "is-on" : ""}" data-turn-id="${escapeHtml(turn.id)}" aria-expanded="${collapsed ? "false" : "true"}" title="${turnToggleLabel}" aria-label="${turnToggleLabel}">
            ${renderTurnCollapseIcon(collapsed)}
          </button>
          <strong>${t("turn.title", { index: index + 1 })}</strong>
        </div>
        <div class="turn-header-actions">
          <span class="state-pill ${stateClasses[turn.state] || "state-idle"}">${stateNames[turn.state] || "UNKNOWN"}</span>
          <button type="button" class="mini-btn ghost-btn turn-copy-btn" data-turn-id="${escapeHtml(turn.id)}">${t("turn.copyTurn")}</button>
          <button type="button" class="mini-btn ghost-btn turn-copy-response-btn" data-turn-id="${escapeHtml(turn.id)}" ${rawResponseText ? "" : "disabled"}>${t("turn.copyResponse")}</button>
        </div>
      </div>
      ${collapsed
        ? `<div class="turn-collapsed-summary">${escapeHtml(turnCollapsedSummary(turn))}</div>`
        : `
          <div class="terminal-message user-message">
            <p>${escapeHtml(turn.task)}<span class="user-inline-label">：User</span></p>
          </div>
          ${turn.thoughts.length
            ? `
              <details class="terminal-detail" data-detail-key="${escapeHtml(thoughtDetailKey)}" ${detailOpenAttribute(thoughtDetailKey, waiting)}>
                <summary>${t("turn.thoughts", { count: turn.thoughts.length })}</summary>
                <div class="terminal-pre rich-text">${renderRichText(turn.thoughts.join("\n\n"))}</div>
              </details>
            `
            : ""}
          <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
            <div class="terminal-label">assistant</div>
            ${renderAssistantResponse(responseText, streaming ? "streaming" : "final")}
          </div>
          ${turn.logs.length
            ? `
              <details class="terminal-detail log-block" data-detail-key="${escapeHtml(logDetailKey)}" ${detailOpenAttribute(logDetailKey, waiting)}>
                <summary>${t("turn.logs", { count: turn.logs.length })}</summary>
                <div class="terminal-pre rich-text">${renderRichText(turn.logs.join("\n"))}</div>
              </details>
            `
            : ""}
        `}
    </section>
  `;
}

function renderSessionCard(session) {
  const identitySession = normalizeWorkspaceSession(session);
  const runtimeState = sessionRuntimeState(session);
  const isActiveReceiver = sessionsStore.getCurrentSessionId() === session.id;
  const isWaiting = isSessionExecuting(session);
  const isRestoring = runtimeState === "restoring";
  const managementDisabled = isRestoring ? "disabled" : "";
  const profileMeta = identitySession.providerId === "hermes"
    ? [identitySession.profileName, identitySession.profileModel].filter(Boolean).join(" · ")
    : "";
  const shouldShowRuntimeState = runtimeState !== "live";
  const stats = sessionCardStats(session);
  const latestOnly = isSessionLatestOnly(session);
  const hasFlowDetails = flowDetailEntriesForSession(session).length > 0;
  const flowsOpen = areSessionFlowDetailsOpen(session);
  const turnsCollapsed = areSessionTurnsCollapsed(session);
  const turnEntries = session.turns.map((turn, index) => ({ turn, index }));
  const visibleTurnEntries = latestOnly && turnEntries.length > 1 ? turnEntries.slice(-1) : turnEntries;
  const hiddenTurnCount = turnEntries.length - visibleTurnEntries.length;
  const managementTitleSuffix = isRestoring ? t("action.restoringSuffix") : "";
  const runtimeLabel = runtimeStateLabel(runtimeState);
  const turnToggleLabel = turnsCollapsed ? t("action.expandAllTurns") : t("action.collapseAllTurns");
  const latestOnlyLabel = latestOnly ? t("action.showAllTurns") : t("action.latestOnly");
  const flowToggleLabel = flowsOpen ? t("action.collapseFlows") : t("action.expandFlows");
  const fullscreenLabel = session.fullscreen ? t("action.exitFullscreen") : t("action.enterFullscreen");
  const identityTitle = sessionIdentityTitle(identitySession);
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}" tabindex="0" aria-label="${escapeHtml(t("session.ariaSwitch", { task: session.task }))}" ${isActiveReceiver ? "aria-current=\"true\"" : ""}>
      <div class="session-card-header">
        <div class="session-identity-row">
          <div class="session-agent-title">
            <strong>${escapeHtml(identityTitle)}</strong>
            ${isActiveReceiver ? `<span class="active-receiver-banner">${t("session.current")}</span>` : ""}
          </div>
          ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
        </div>
        <div class="session-control-row">
          <div class="session-status-cluster">
            ${shouldShowRuntimeState ? `<span class="runtime-pill ${runtimeStateClasses[runtimeState] || "runtime-archived"} ${isWaiting ? "is-busy" : ""}" aria-label="${escapeHtml(t("session.statusAria", { state: runtimeLabel }))}">${escapeHtml(runtimeLabel)}</span>` : ""}
            <div class="session-card-stats" aria-label="${t("session.statsAria")}">
              <button type="button" class="session-stat-pill session-turns-toggle-btn ${turnsCollapsed ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${turnsCollapsed ? "true" : "false"}" title="${turnToggleLabel}" aria-label="${turnToggleLabel}" ${session.turns.length ? "" : "disabled"}>${t("session.turns", { count: session.turns.length })}</button>
              ${stats.map((item) => `<span class="session-stat-pill" data-stat-key="${escapeHtml(item.key)}">${escapeHtml(item.label)}</span>`).join("")}
            </div>
          </div>
          <div class="session-card-actions">
            ${isWaiting && runtimeState === "live" ? `<button type="button" class="mini-btn ghost-btn session-action-btn session-stop-btn" data-session-id="${session.id}" title="${t("action.stop")}" aria-label="${t("action.stop")}">${renderSessionActionIcon("stop")}</button>` : ""}
            <button type="button" class="mini-btn ghost-btn session-action-btn session-dismiss-btn" data-session-id="${session.id}" title="${t("action.dismiss")}${managementTitleSuffix}" aria-label="${t("action.dismiss")}" ${managementDisabled}>${renderSessionActionIcon("dismiss")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn session-archive-btn" data-session-id="${session.id}" title="${t("action.archive")}${managementTitleSuffix}" aria-label="${t("action.archive")}" ${managementDisabled}>${renderSessionActionIcon("archive")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="${t("action.delete")}${managementTitleSuffix}" aria-label="${t("action.delete")}" ${managementDisabled}>${renderSessionActionIcon("delete")}</button>
            ${canRestoreSession(session) ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">${t("session.restoreRetry")}</button>` : ""}
            <div class="session-tool-group" role="group" aria-label="${t("session.actionsAria")}">
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="${t("action.copySession")}" aria-label="${t("action.copySession")}" ${session.turns.length ? "" : "disabled"}>${renderSessionActionIcon("copy")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnlyLabel}" aria-label="${latestOnlyLabel}" ${session.turns.length > 1 ? "" : "disabled"}>${renderSessionActionIcon(latestOnly ? "all" : "latest")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-toggle-flows-btn ${flowsOpen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${flowsOpen ? "true" : "false"}" title="${flowToggleLabel}" aria-label="${flowToggleLabel}" ${hasFlowDetails ? "" : "disabled"}>${renderSessionActionIcon(flowsOpen ? "collapse" : "expand")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="${t("action.scrollLatest")}" aria-label="${t("action.scrollLatest")}">${renderSessionActionIcon("latestScroll")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-fullscreen-btn ${session.fullscreen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${session.fullscreen ? "true" : "false"}" title="${fullscreenLabel}" aria-label="${fullscreenLabel}">
                ${renderSessionActionIcon(session.fullscreen ? "fullscreenExit" : "fullscreen")}
              </button>
            </div>
          </div>
        </div>
        <div class="caption session-task">${escapeHtml(t("session.task", { task: session.task }))}</div>
      </div>
      <div class="session-card-body">
        ${session.turns.length
          ? `${hiddenTurnCount ? `<div class="session-hidden-turns">${t("session.hiddenTurns", { count: hiddenTurnCount })}</div>` : ""}${visibleTurnEntries.map(({ turn, index }) => renderTurn(turn, index)).join("")}<div class="session-latest-anchor">${isWaiting ? "streaming..." : "latest"}</div>`
          : `<p class='flow-empty'>${t("session.noMessages")}</p>`}
      </div>
    </article>
  `;
}

function exitFullscreenSessions() {
  const fullscreenSessions = sessions.filter((session) => session.fullscreen);
  if (!fullscreenSessions.length) return false;
  fullscreenSessions.forEach((session) => {
    session.fullscreen = false;
  });
  renderWorkspace();
  setAppNotice("已退出会话全屏阅读模式。");
  return true;
}

function bindSessionActions() {
  sessionDeck.querySelectorAll(".session-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, summary, details, input, textarea, select")) return;
      if (window.getSelection()?.toString()) return;
      activateWorkspaceSession(card.dataset.sessionId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.target !== card) return;
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      activateWorkspaceSession(card.dataset.sessionId);
    });
  });
  sessionDeck.querySelectorAll(".session-fullscreen-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId;
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) return;
      session.fullscreen = !session.fullscreen;
      renderWorkspace();
    });
  });
  sessionDeck.querySelectorAll(".session-dismiss-btn").forEach((button) => {
    button.addEventListener("click", () => dismissWorkspaceSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-archive-btn").forEach((button) => {
    button.addEventListener("click", () => archiveLiveSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-stop-btn").forEach((button) => {
    button.addEventListener("click", () => stopSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-delete-btn").forEach((button) => {
    button.addEventListener("click", () => requestDeleteConfirmation(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-retry-btn").forEach((button) => {
    button.addEventListener("click", () => restoreArchivedSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".terminal-detail[data-detail-key]").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      flowDetailOpenState.set(detail.dataset.detailKey, detail.open);
    });
  });
  sessionDeck.querySelectorAll(".session-scroll-latest-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId;
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
      if (!body) return;
      const controller = sessionStickRegistry.ensure(sessionId, body, { initialStuck: true });
      controller.scrollToBottom();
    });
  });
  sessionDeck.querySelectorAll(".session-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionId);
      const text = session ? sessionTranscriptText(session) : "";
      if (!text) {
        setAppNotice("当前会话还没有可复制的 transcript。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? "已复制当前会话 transcript。" : "复制失败，请手动选择内容。", copied ? "muted" : "error");
    });
  });
  sessionDeck.querySelectorAll(".session-latest-only-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSessionLatestOnly(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-turns-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSessionTurnsCollapsed(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-toggle-flows-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionId);
      if (!session) return;
      const shouldOpen = !areSessionFlowDetailsOpen(session);
      setSessionFlowDetails(session.id, shouldOpen);
      setAppNotice(shouldOpen ? "已展开当前会话的思考流与运行流。" : "已折叠当前会话的思考流与运行流。");
    });
  });
  sessionDeck.querySelectorAll(".turn-collapse-btn").forEach((button) => {
    button.addEventListener("click", () => toggleTurnCollapsed(button.dataset.turnId));
  });
  sessionDeck.querySelectorAll(".turn-copy-response-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = findTurnById(button.dataset.turnId);
      const text = result ? turnResponseText(result.turn) : "";
      if (!text) {
        setAppNotice("当前轮次还没有可复制的响应。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? "已复制当前轮次响应。" : "复制失败，请手动选择内容。", copied ? "muted" : "error");
    });
  });
  sessionDeck.querySelectorAll(".turn-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = findTurnById(button.dataset.turnId);
      const text = result ? turnTranscriptText(result.turn, result.turnIndex) : "";
      if (!text) {
        setAppNotice("当前轮次还没有可复制的 transcript。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? "已复制当前轮次 transcript。" : "复制失败，请手动选择内容。", copied ? "muted" : "error");
    });
  });
  sessionDeck.querySelectorAll(".md-code-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
      if (!code) {
        setAppNotice("当前代码块为空。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(code);
      setAppNotice(copied ? "已复制代码块。" : "复制失败，请手动选择代码。", copied ? "muted" : "error");
    });
  });
}

function activateWorkspaceSession(sessionId, options = {}) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  saveCurrentTargetAgent(session.agentId);
  saveCurrentSession(session.id);
  if (canSendToSession(session)) markSessionActive(session.id);
  renderProviders();
  renderWorkspace({ focusSessionId: options.focusWorkspace ? session.id : null });
  renderHistory({ scrollSessionId: session.id });
  const runtimeState = sessionRuntimeState(session);
  setAppNotice(canSendToSession(session)
    ? `当前工作 session 已切换到：${session.task}`
    : runtimeState === "restoring"
      ? "已定位到正在重连的会话，请稍等。"
      : "已切换到只读会话；继续发送会创建新的 live 会话或需要先恢复。");
}

async function shutdownRuntimeSession(session) {
  const commands = acpCommandsForProvider(session.providerId);
  if (!commands) return false;
  return invoke(commands.shutdown, { runtimeSessionId: session.id });
}

function markSessionStopped(session) {
  const turn = session.turns.find((item) => item.id === session.activeTurnId)
    || [...session.turns].reverse().find((item) => executingSessionStates.has(item.state))
    || session.turns.at(-1);
  if (!turn) {
    session.state = 6;
    return null;
  }
  turn.state = 6;
  if (!turn.finalResponse || turn.finalResponse === "正在等待运行时返回内容...") {
    turn.finalResponse = "会话已停止。";
  }
  turn.logs = ["用户已停止该会话运行。", ...turn.logs];
  session.state = 6;
  return turn;
}

async function archiveLiveSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const shouldMarkStopped = isSessionExecuting(session);
  if (shouldMarkStopped) setSessionLifecycle(session, LIFECYCLE.stopped);
  try {
    await shutdownRuntimeSession(session);
  } catch (error) {
    console.error(error);
  }
  const stoppedTurn = shouldMarkStopped ? markSessionStopped(session) : null;
  setSessionLifecycle(session, LIFECYCLE.archived);
  try {
    await invoke("archive_history_session_entries", { sessionId });
    if (stoppedTurn) await saveTurnToHistory(session, stoppedTurn);
    historyEntries = await invoke("load_history_entries");
  } catch (error) {
    console.error(error);
  }
  removeSessionFromWorkspace(session.id);
  renderWorkspace();
  renderHistory();
  setAppNotice(`${session.agentName} 已归档，ACP runtime 已释放。`);
}

async function detachRuntimeKeepActive(session) {
  try {
    await shutdownRuntimeSession(session);
  } catch (error) {
    console.error(error);
  }
  setSessionLifecycle(session, LIFECYCLE.live);
}

async function stopSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const runtimeState = sessionRuntimeState(session);
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，暂不支持停止。", "busy");
    return;
  }
  if (runtimeState !== "live") {
    setAppNotice("该会话当前没有可停止的 live runtime。", "busy");
    return;
  }
  setSessionLifecycle(session, LIFECYCLE.stopped);
  await detachRuntimeKeepActive(session);
  const stoppedTurn = markSessionStopped(session);
  try {
    if (stoppedTurn) await saveTurnToHistory(session, stoppedTurn);
    historyEntries = await invoke("load_history_entries");
  } catch (error) {
    console.error(error);
  }
  renderProviders();
  renderWorkspace();
  renderHistory();
  setAppNotice(`${session.agentName} 已停止运行，仍保留为活跃会话。`);
}

function removeSessionFromWorkspace(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  if (scheduledWorkspaceRenderOptions?.focusSessionId === sessionId) {
    scheduledWorkspaceRenderOptions = { ...scheduledWorkspaceRenderOptions, focusSessionId: null };
  }
  sessionsStore.removeSessionById(sessionId);
  markSessionInactive(session.id);
  clearCurrentSessionIf(session.id);
  return session;
}

async function dismissWorkspaceSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const runtimeState = sessionRuntimeState(session);
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，请稍后再退出工作台。", "busy");
    return;
  }
  if (runtimeState === "live") {
    await detachRuntimeKeepActive(session);
    const lastTurn = session.turns.at(-1);
    if (lastTurn) {
      try {
        await saveTurnToHistory(session, lastTurn);
        historyEntries = await invoke("load_history_entries");
      } catch (error) {
        console.error(error);
      }
    }
  }
  const removed = removeSessionFromWorkspace(sessionId);
  if (!removed) return;
  renderWorkspace();
  renderHistory();
  setAppNotice(`${removed.agentName} 已移出工作台，仍保留在活跃会话。`);
}

async function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const runtimeState = session ? sessionRuntimeState(session) : archived?.runtimeState || "archived";
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，暂不支持删除。", "busy");
    return;
  }
  if (!session && !archived) return;
  if (isLaunchDemoScene && sessionId.startsWith("demo-session-")) {
    sessionsStore.removeSessionById(sessionId);
    demoHistoryEntries = demoHistoryEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    renderWorkspace();
    renderHistory();
    setAppNotice("已从演示场景移除该会话。");
    return;
  }
  try {
    if (session) {
      setSessionLifecycle(session, LIFECYCLE.deleted);
    } else {
      markSessionDeletedTombstone(sessionId);
    }
    if (session && runtimeState === "live") {
      try {
        await shutdownRuntimeSession(session);
      } catch (shutdownError) {
        console.error(shutdownError);
      }
    }
    removeSessionFromWorkspace(sessionId);
    const result = await invoke("delete_history_session_entries", { sessionId });
    historyEntries = historyEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    demoHistoryEntries = demoHistoryEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    renderWorkspace();
    renderHistory();
    const skipped = result?.skippedFiles ? `，跳过损坏文件 ${result.skippedFiles} 个` : "";
    setAppNotice(`已删除会话，移除历史轮次 ${result?.removedCount || 0} 条${skipped}。`);
  } catch (error) {
    console.error(error);
    setAppNotice(`删除会话失败：${formatBackendError(error)}`, "error");
  }
}

function requestDeleteConfirmation(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const title = session?.task || archived?.title || "该会话";
  openConfirmDialog({
    title: "删除会话",
    message: `确定要删除「${title}」吗？此操作无法撤销。`,
    confirmLabel: "删除",
    onConfirm: () => deleteSession(sessionId),
  });
}

function renderWorkspace(options = {}) {
  const focusSessionId = options.focusSessionId || null;
  const preserveDeckScroll = options.preserveDeckScroll === true;
  const deckScrollLeft = sessionDeck.scrollLeft;
  const deckScrollTop = sessionDeck.scrollTop;
  const stickyIntent = sampleSessionStickyIntent();
  const workspaceSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
  const visibleSessions = [...workspaceSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  document.body.classList.toggle("is-launch-demo", isLaunchDemoScene);
  sessionDeck.classList.toggle("is-launch-demo", isLaunchDemoScene);
  updatePromptPlaceholder();
  renderWorkspaceStatus();
  workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
  if (!visibleSessions.length) updateWorkspaceEmptyCopy();
  sessionDeck.classList.toggle("is-single-session", visibleSessions.length === 1);
  sessionDeck.classList.toggle("is-two-sessions", visibleSessions.length === 2);
  sessionDeck.classList.toggle("is-many-sessions", visibleSessions.length > 2);
  sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
  bindSessionActions();
  renderMermaidDiagrams(sessionDeck).catch((error) => console.error(error));
  requestAnimationFrame(() => {
    const focusedSessionId = sessionsStore.getCurrentSessionId();
    const activeCard = focusedSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${focusedSessionId}"]`)
      : null;
    if (!preserveDeckScroll) {
      activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else {
      sessionDeck.scrollLeft = deckScrollLeft;
      sessionDeck.scrollTop = deckScrollTop;
    }
    const focusCard = focusSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${focusSessionId}"]`)
      : null;
    focusCard?.focus({ preventScroll: true });
    syncSessionStickControllers(visibleSessions, stickyIntent);
    if (preserveDeckScroll) {
      sessionDeck.scrollLeft = deckScrollLeft;
      sessionDeck.scrollTop = deckScrollTop;
    }
  });
}

function sampleSessionStickyIntent() {
  const map = new Map();
  sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
    const sessionId = body.closest(".session-card")?.dataset.sessionId;
    if (!sessionId) return;
    const controller = sessionStickRegistry.get(sessionId);
    map.set(sessionId, controller ? controller.isStuck : isAtBottom(body));
  });
  return map;
}

const pendingCardRenders = new Set();
let pendingCardRenderFrame = 0;

function scheduleSessionCardRender(sessionId) {
  if (!sessionId) return;
  pendingCardRenders.add(sessionId);
  if (pendingCardRenderFrame) return;
  pendingCardRenderFrame = requestAnimationFrame(() => {
    const targets = [...pendingCardRenders];
    pendingCardRenders.clear();
    pendingCardRenderFrame = 0;
    targets.forEach((id) => renderSessionCardInPlace(id));
  });
}

function renderSessionCardInPlace(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const card = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"]`);
  if (!card) {
    scheduleWorkspaceRender({ preserveDeckScroll: true });
    return;
  }
  const previousBody = card.querySelector(".session-card-body");
  const previousController = sessionStickRegistry.get(sessionId);
  const previousStuck = previousController
    ? previousController.isStuck
    : previousBody
      ? isAtBottom(previousBody)
      : true;
  const template = document.createElement("template");
  template.innerHTML = renderSessionCard(session).trim();
  const newArticle = template.content.firstElementChild;
  if (!(newArticle instanceof HTMLElement)) return;
  card.className = newArticle.className;
  card.innerHTML = newArticle.innerHTML;
  bindSessionActions();
  renderMermaidDiagrams(card).catch((error) => console.error(error));
  const newBody = card.querySelector(".session-card-body");
  if (newBody) {
    const controller = sessionStickRegistry.ensure(sessionId, newBody, { initialStuck: previousStuck });
    controller.notifyContentChanged();
  }
}

function syncSessionStickControllers(visibleSessions, stickyIntent) {
  const ids = [];
  visibleSessions.forEach((session) => {
    const card = sessionDeck.querySelector(`.session-card[data-session-id="${session.id}"]`);
    const body = card?.querySelector(".session-card-body");
    if (!body) return;
    const previousStuck = stickyIntent.has(session.id) ? stickyIntent.get(session.id) : true;
    const controller = sessionStickRegistry.ensure(session.id, body, { initialStuck: previousStuck });
    controller.notifyContentChanged();
    ids.push(session.id);
  });
  sessionStickRegistry.sweep(ids);
}


function readableHistoryEntries() {
  return isLaunchDemoScene ? demoHistoryEntries : [...demoHistoryEntries, ...historyEntries];
}



function sessionListItems() {
  const sourceSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
  const liveItems = sourceSessions.map((session) => {
    const identitySession = normalizeWorkspaceSession(session);
    const lastTurn = session.turns.at(-1);
    return {
      id: session.id,
      date: session.createdAt.slice(0, 10),
      createdAt: session.createdAt,
      updatedAt: lastTurn?.createdAt || session.createdAt,
      providerName: identitySession.providerName,
      agentName: identitySession.agentName,
      title: session.task || t("history.newSession"),
      summary: lastTurn?.finalResponse || lastTurn?.outputs.at(-1) || lastTurn?.logs.at(-1) || t("session.current"),
      turnCount: session.turns.length,
      runtimeState: sessionRuntimeState(session),
      agentId: identitySession.agentId,
      runtimeInstanceId: identitySession.runtimeInstanceId || null,
      targetId: identitySession.targetId || identitySession.agentId,
      isInWorkspace: true,
      isRuntimeAttached: true,
    };
  });
  const liveIds = new Set(liveItems.map((item) => item.id));
  const historyItems = archivedSessionsFromHistory(readableHistoryEntries())
    .filter((item) => !liveIds.has(item.id))
    .map((item) => ({
      ...item,
      runtimeState: item.runtimeState || "archived",
      isInWorkspace: false,
      isRuntimeAttached: false,
    }));
  return [...liveItems, ...historyItems].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function renderHistory(options = {}) {
  const scrollSessionId = options.scrollSessionId || null;
  if (isHistoryLoading) {
    historyList.innerHTML = `
      <div class="history-empty">
        <strong>${t("history.loadingTitle")}</strong>
        <p>${t("history.loadingText")}</p>
      </div>
    `;
    return;
  }

  const sessionItems = sessionListItems();
  const activeItems = sessionItems.filter(isActiveSessionListItem);
  const archivedItems = sessionItems.filter(isArchivedSessionListItem);
  if (!sessionItems.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <strong>${t("history.emptyTitle")}</strong>
        <p>${t("history.emptyText")}</p>
      </div>
    `;
    return;
  }

  historyList.innerHTML = `
    ${renderSessionListSection("active", t("history.activeTitle"), t("history.activeNote"), activeItems, t("history.activeEmpty"))}
    ${renderSessionListSection("archive", t("history.archiveTitle"), t("history.archiveNote"), archivedItems, t("history.archiveEmpty"))}
  `;
  bindSessionListActions();
  if (scrollSessionId) {
    requestAnimationFrame(() => {
      const activeItem = historyList.querySelector(`.history-item[data-session-id="${scrollSessionId}"]`);
      activeItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

function renderSessionListSection(sectionId, title, note, items, emptyText) {
  return `
    <details class="history-section" data-history-section="${sectionId}" ${sessionListSectionOpenState[sectionId] ? "open" : ""}>
      <summary class="history-section-summary">
        <span class="history-section-label">
          <span class="history-section-caret">▸</span>
          <span>
            <strong>${title}</strong>
            <span class="history-section-note">${note}</span>
          </span>
        </span>
        <span class="history-section-count">${items.length}</span>
      </summary>
      ${items.length
        ? `<div class="history-group-list">${items.map(renderSessionListItem).join("")}</div>`
        : `<p class="history-section-empty">${emptyText}</p>`}
    </details>
  `;
}

function renderSessionListItem(item) {
  const isActiveHistoryItem = sessionsStore.getCurrentSessionId() === item.id;
  const isArchived = isArchivedSessionListItem(item);
  const signalClass = isActiveHistoryItem || item.isInWorkspace
    ? "signal-workspace"
    : isArchived
      ? "signal-archive"
      : "signal-active";
  const signalLabel = isActiveHistoryItem
    ? t("history.signal.current")
    : item.isInWorkspace
      ? t("history.signal.workspace")
      : isArchived
        ? t("history.signal.archive")
        : t("history.signal.live");
  const listStateClass = isArchived ? "is-archive" : "is-active-history";
  const shouldShowState = item.runtimeState !== "archived" && item.runtimeState !== "live";
  const stateLabel = shouldShowState ? runtimeStateLabel(item.runtimeState) : "";
  return `
    <article class="history-item ${listStateClass} ${isActiveHistoryItem ? "is-active-session" : ""}" data-session-id="${item.id}" data-agent-id="${item.agentId || ""}" ${isActiveHistoryItem ? "aria-current=\"true\"" : ""}>
      <div class="history-item-top">
        <strong class="history-tool-name"><span class="history-signal ${signalClass}" title="${escapeHtml(signalLabel)}" aria-label="${escapeHtml(signalLabel)}"></span>${escapeHtml(item.providerName)}</strong>
        <div class="history-item-actions">
          ${shouldShowState ? `<span class="history-state-pill">${escapeHtml(stateLabel)}</span>` : ""}
          <button type="button" class="history-delete-btn" data-session-id="${item.id}" title="${t("history.delete")}" aria-label="${t("history.delete")}">${renderSessionActionIcon("delete")}</button>
        </div>
      </div>
      <div class="history-item-meta">
        <span>${escapeHtml(item.agentName)}</span>
        <time>${escapeHtml(item.updatedAt.slice(5, 10))} ${formatTime(item.updatedAt)}</time>
      </div>
      <p class="history-task-title">${escapeHtml(item.title)}</p>
    </article>
  `;
}

function bindSessionListActions() {
  historyList.querySelectorAll(".history-section").forEach((section) => {
    section.addEventListener("toggle", () => {
      sessionListSectionOpenState[section.dataset.historySection] = section.open;
    });
  });
  historyList.querySelectorAll(".history-delete-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      requestDeleteConfirmation(button.dataset.sessionId);
    });
  });
  historyList.querySelectorAll(".history-item.is-active-history").forEach((item) => {
    item.addEventListener("click", () => {
      const sessionId = item.dataset.sessionId;
      if (!sessions.some((entry) => entry.id === sessionId)) {
        restoreArchivedSession(sessionId);
        return;
      }
      activateWorkspaceSession(sessionId, { focusWorkspace: true });
    });
  });
  historyList.querySelectorAll(".history-item.is-archive").forEach((item) => {
    item.addEventListener("click", () => {
      restoreArchivedSession(item.dataset.sessionId);
    });
  });
}

function ensureArchivedAgent(archived) {
  const provider = providerById(archived.providerId) || providers[0];
  let agent = agentById(archived.agentId);
  if (!agent) {
    agent = {
      id: archived.agentId,
      providerId: provider.id,
      name: archived.agentName.split(" / ").at(-1) || "历史会话",
      subtitle: "历史归档",
      note: "从历史归档恢复的只读会话。",
      state: 5,
      isArchivedAgent: true,
    };
    providersStore.appendProviderAgent(provider.id, agent);
  }
  if (provider.id === "hermes") {
    const hermesProfile = hermesProfileMetaFromArchived(archived);
    const liveAgent = [...runtimeTargets(), ...provider.agents].find((entry) =>
      entry.id === archived.agentId
      || (hermesProfile?.profileName && entry.profileName === hermesProfile.profileName)
      || (hermesProfile?.profileAlias && entry.profileAlias === hermesProfile.profileAlias)
      || (hermesProfile?.profilePath && entry.profilePath === hermesProfile.profilePath)
    );
    if (liveAgent) {
      agent.profileName = liveAgent.profileName || agent.profileName || null;
      agent.alias = liveAgent.alias || agent.alias || hermesProfile?.profileAlias || null;
      agent.profileAlias = liveAgent.profileAlias || agent.profileAlias || hermesProfile?.profileAlias || null;
      agent.profileExecutable = liveAgent.profileExecutable || agent.profileExecutable || hermesProfile?.profileExecutable || null;
      agent.profilePath = liveAgent.profilePath || agent.profilePath || hermesProfile?.profilePath || null;
      agent.model = liveAgent.model || agent.model || hermesProfile?.profileModel || null;
      agent.gateway = liveAgent.gateway || agent.gateway || hermesProfile?.gateway || null;
      agent.runtimeInstanceId = liveAgent.runtimeInstanceId || agent.runtimeInstanceId || null;
      agent.runtimeLabel = liveAgent.runtimeLabel || agent.runtimeLabel || null;
      agent.runtimeHost = liveAgent.runtimeHost || agent.runtimeHost || null;
      agent.runtimeCommand = liveAgent.runtimeCommand || agent.runtimeCommand || null;
    } else if (hermesProfile) {
      agent.profileName = hermesProfile.profileName || agent.profileName || null;
      agent.alias = hermesProfile.profileAlias || agent.alias || null;
      agent.profileAlias = hermesProfile.profileAlias || agent.profileAlias || null;
      agent.profileExecutable = hermesProfile.profileExecutable || agent.profileExecutable || null;
      agent.profilePath = hermesProfile.profilePath || agent.profilePath || null;
      agent.model = hermesProfile.profileModel || agent.model || null;
      agent.gateway = hermesProfile.gateway || agent.gateway || null;
    }
  }
  return agent;
}

async function restoreArchivedSession(sessionId) {
  if (!sessionId) return;
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  if (!archived) return;
  const existing = sessions.find((item) => item.id === archived.id);
  if (existing && sessionRuntimeState(existing) === "restoring") {
    setAppNotice("该 session 正在重连中，请稍等。", "busy");
    return;
  }
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
    task: archived.title,
    state: 5,
    turns: archived.turns,
    createdAt: archived.createdAt,
    fullscreen: false,
    acpSessionId: archived.acpSessionId,
    lifecycle: LIFECYCLE.archived,
    runtimeState: LIFECYCLE.archived,
    profileName: archived.hermesProfile?.profileName || null,
    profileAlias: archived.hermesProfile?.profileAlias || null,
    profileExecutable: archived.profileExecutable || archived.hermesProfile?.profileExecutable || null,
    profilePath: archived.hermesProfile?.profilePath || null,
    profileModel: archived.hermesProfile?.profileModel || null,
    gateway: archived.hermesProfile?.gateway || null,
    skillCount: archived.hermesProfile?.skillCount ?? null,
    hasSoul: archived.hermesProfile?.hasSoul || false,
  };
  const restoredAgent = ensureArchivedAgent(archived);
  restored.profileName = restored.profileName || restoredAgent.profileName || null;
  restored.profileAlias = restored.profileAlias || restoredAgent.profileAlias || restoredAgent.alias || null;
  restored.profileExecutable = restored.profileExecutable || restoredAgent.profileExecutable || restoredAgent.alias || null;
  restored.profilePath = restored.profilePath || restoredAgent.profilePath || restoredAgent.path || null;
  restored.profileModel = restored.profileModel || restoredAgent.model || null;
  restored.gateway = restored.gateway || restoredAgent.gateway || null;
  restored.runtimeInstanceId = restored.runtimeInstanceId || restoredAgent.runtimeInstanceId || null;
  restored.runtimeLabel = restored.runtimeLabel || restoredAgent.runtimeLabel || null;
  restored.runtimeHost = restored.runtimeHost || restoredAgent.runtimeHost || null;
  restored.runtimeCommand = restored.runtimeCommand || restoredAgent.runtimeCommand || null;
  const restoredInstance = runtimeInstanceById(restored.runtimeInstanceId);
  if (restoredInstance) {
    restored.runtimeLabel = restored.runtimeLabel || restoredInstance.runtimeLabel || null;
    restored.runtimeHost = restored.runtimeHost || runtimeHostForInstance(restoredInstance);
    restored.runtimeCommand = restored.runtimeCommand || restoredInstance.command || null;
  }
  const runtimeDefaults = runtimeDefaultsForProvider(restored.providerId, restored.runtimeInstanceId);
  restored.runtimeInstanceId = restored.runtimeInstanceId || runtimeDefaults.runtimeInstanceId || null;
  restored.runtimeLabel = restored.runtimeLabel || runtimeDefaults.runtimeLabel || null;
  restored.runtimeHost = restored.runtimeHost || runtimeDefaults.runtimeHost || null;
  restored.runtimeCommand = restored.runtimeCommand || runtimeDefaults.runtimeCommand || null;
  if (restored.providerId === "hermes") {
    restored.profileExecutable = inferHermesProfileExecutable(archived, restored);
  }
  restored.targetId = restored.targetId || restored.agentId;
  Object.assign(restored, normalizeWorkspaceSession(restored));
  if (!existing) sessionsStore.upsertHead(restored);
  sessionsStore.unmarkStopped(restored.id);
  saveCurrentTargetAgent(restored.agentId);
  saveCurrentSession(restored.id);
  renderProviders();
  renderWorkspace();
  renderHistory();
  if (!restored.acpSessionId) {
    setSessionLifecycle(restored, LIFECYCLE.archived);
    renderWorkspace();
    renderHistory();
    setAppNotice("已从历史归档恢复会话。缺少 ACP sessionId，当前为只读 transcript。");
    return;
  }
  setSessionLifecycle(restored, LIFECYCLE.restoring);
  renderWorkspace();
  renderHistory();
  setAppNotice("已恢复历史 transcript，正在尝试加载 ACP runtime...", "busy");
  const commands = acpCommandsForProvider(restored.providerId);
  if (!commands) {
    setSessionLifecycle(restored, LIFECYCLE.archived);
    markSessionInactive(restored.id);
    saveCurrentSession(restored.id);
    renderWorkspace();
    renderHistory();
    setAppNotice("该 provider 暂不支持 ACP runtime 恢复，当前为只读 transcript。");
    return;
  }
  try {
    await invoke(commands.load, {
      runtimeSessionId: restored.id,
      acpSessionId: restored.acpSessionId,
      cwd: null,
      runtimeHost: restored.runtimeHost || null,
      runtimeCommand: restored.runtimeCommand || null,
      profileExecutable: restored.profileExecutable || null,
    });
    setSessionLifecycle(restored, LIFECYCLE.live);
    markSessionActive(restored.id);
    saveCurrentSession(restored.id);
    renderWorkspace();
    renderHistory();
    setAppNotice("历史 session 已重连为可续聊的 ACP runtime。");
  } catch (loadError) {
    const formattedLoadError = formatBackendError(loadError);
    try {
      await invoke(commands.resume, {
        runtimeSessionId: restored.id,
        acpSessionId: restored.acpSessionId,
        cwd: null,
        runtimeHost: restored.runtimeHost || null,
        runtimeCommand: restored.runtimeCommand || null,
        profileExecutable: restored.profileExecutable || null,
      });
      setSessionLifecycle(restored, LIFECYCLE.live);
      markSessionActive(restored.id);
      saveCurrentSession(restored.id);
      renderWorkspace();
      renderHistory();
      setAppNotice("ACP load 失败，已通过 resume 重连为可续聊的 runtime。");
    } catch (resumeError) {
      const formattedResumeError = formatBackendError(resumeError || loadError);
      appendRuntimeLogToSession(
        restored,
        [
          "ACP runtime 重连失败，已保留只读 transcript。",
          `load 失败：${formattedLoadError}`,
          `resume 失败：${formattedResumeError}`,
        ].join("\n"),
        9,
      );
      setSessionLifecycle(restored, LIFECYCLE.resume_failed);
      markSessionInactive(restored.id);
      saveCurrentSession(restored.id);
      renderWorkspace();
      renderHistory();
      setAppNotice("ACP runtime 重连失败，已保留只读 transcript。", "error");
    }
  }
}

async function loadHistory() {
  try {
    const compactResult = await invoke("compact_history_entries");
    historyEntries = await invoke("load_history_entries");
    const notice = formatCompactHistoryNotice(compactResult);
    if (notice) setAppNotice(notice.message, notice.kind);
  } catch (error) {
    console.error(error);
    historyEntries = [];
    setAppNotice("历史任务读取失败，已回退为空列表。", "error");
  } finally {
    isHistoryLoading = false;
  }
  renderHistory();
}

async function saveTurnToHistory(session, turn) {
  const entry = await invoke("append_history_entry", {
    entry: buildHistoryEntryPayload({
      session,
      turn,
      hermesProfile: hermesProfileMetaFromSession(session),
      schemaVersion: HISTORY_SCHEMA_VERSION,
      runtimeState: sessionRuntimeState(session),
      getStateName: (state) => stateNames[state],
    }),
  });
  historyEntries = upsertHistoryEntry(historyEntries, entry);
  renderHistory();
}

async function runFallbackSession(session, turn) {
  const providerId = session.providerId;
  const fallback = fallbackSessions[providerId];
  if (!fallback) return;
  runningSessions += 1;
  updateActionLabels();
  if (session.providerId === "hermes") {
    turn.state = 2;
    session.state = 2;
    prependHermesStartupNoticeIfNeeded(session, turn);
    renderWorkspace();
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    const saved = updateTurnFromEvents(session.id, turn.id, fallback.events);
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    if (saved) {
      await saveTurnToHistory(session, saved);
      setAppNotice(`${session.agentName} 会话已完成并写入历史。`);
    }
  } catch (error) {
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    appendErrorToTurn(session.id, turn.id, formatBackendError(error));
    await saveTurnToHistory(session, turn);
  } finally {
    runningSessions = Math.max(0, runningSessions - 1);
    updateActionLabels();
  }
}

async function startAcpSession(session, turn) {
  const commands = acpCommandsForProvider(session.providerId);
  if (!commands) {
    void runFallbackSession(session, turn);
    return;
  }
  runningSessions += 1;
  updateActionLabels();
  if (session.providerId === "hermes") {
    turn.state = 2;
    session.state = 2;
    prependHermesStartupNoticeIfNeeded(session, turn);
    renderWorkspace();
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke(commands.prompt, {
      runtimeSessionId: session.id,
      prompt: turn.task,
      cwd: null,
      runtimeHost: session.runtimeHost || null,
      runtimeCommand: session.runtimeCommand || null,
      profileExecutable: session.profileExecutable || null,
    });
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    const saved = updateTurnFromEvents(session.id, turn.id, events);
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    if (saved) {
      const agent = agentById(session.agentId);
      if (agent) {
        agent.state = session.state;
      }
      renderProviders();
      await saveTurnToHistory(session, saved);
      setAppNotice(`${session.agentName} 会话已完成并写入历史。`);
    }
  } catch (error) {
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    appendErrorToTurn(session.id, turn.id, formatBackendError(error));
    await saveTurnToHistory(session, turn);
  } finally {
    runningSessions = Math.max(0, runningSessions - 1);
    updateActionLabels();
  }
}

function startSessionFromPrompt(forceNewSession = false) {
  if (isLaunchDemoScene) {
    setAppNotice("演示场景不会写入真实 runtime。请先清除演示再发送任务。", "busy");
    return;
  }
  const task = promptBox.value.trim();
  if (!task) {
    promptBox.focus();
    return;
  }

  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  if (!agent || !provider) {
    setAppNotice("请先在左侧设定当前发送目标，再发送任务。", "error");
    return;
  }
  if (!canSendToProvider(provider.id)) {
    const availability = providerAvailability(provider.id);
    const label = providerAvailabilityLabel(availability.summary);
    setAppNotice(`${provider.name} 当前${label}，请点击“维护”配置或检查本机 runtime。`, "error");
    return;
  }

  const session = getOrCreateActiveSession(task, forceNewSession);
  if (!session) return;
  if (forceNewSession) saveCurrentSession(null);
  stoppedSessionIds.delete(session.id);
  const turn = createTurn(session, task);
  promptBox.value = "";
  sendAsNewSession = false;
  updateActionLabels();

  const commands = acpCommandsForProvider(provider.id);
  if (commands) {
    void startAcpSession(session, turn);
    return;
  }

  void runFallbackSession(session, turn);
}

providerManagerBtn?.addEventListener("click", () => {
  openProviderManager();
});

sendBtn.addEventListener("click", () => {
  startSessionFromPrompt(sendAsNewSession);
});

sendModeBtn?.addEventListener("click", () => {
  toggleSendMode();
});

fontScaleBtn?.addEventListener("click", () => {
  cycleFontScale();
});

languageBtn?.addEventListener("click", () => {
  toggleLanguage();
});

demoSceneBtn?.addEventListener("click", () => {
  if (isLaunchDemoScene) {
    leaveLaunchDemoScene();
    return;
  }
  activateLaunchDemoScene();
});

promptBox.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) return;
  const shouldSend = sendMode === "enter"
    ? !event.ctrlKey && !event.shiftKey && !event.altKey
    : event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!shouldSend) return;
  event.preventDefault();
  startSessionFromPrompt(sendAsNewSession);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (exitFullscreenSessions()) event.preventDefault();
});

newSessionToggle.addEventListener("click", () => {
  sendAsNewSession = !sendAsNewSession;
  updateActionLabels();
});

if (listenRuntimeEvent) {
  listenRuntimeEvent("runtime-session-update", (payload) => {
    const runtimeSessionId = payload?.payload?.runtimeSessionId;
    const event = payload?.payload?.event;
    if (!runtimeSessionId || !event) return;
    appendStreamEventToTurn(runtimeSessionId, event);
  }).catch((error) => {
    console.error(error);
  });
}

renderProviders();
applyStaticTranslations();
applyFontScale();
updateSendModeLabel();
renderWorkspace();
renderHistory();
updateActionLabels();
setTimeout(() => {
  void loadHistory();
}, 0);
setTimeout(() => {
  refreshRuntimeProbe().then(() => {
    if (availableRuntimeInstancesForProvider("hermes").length) void loadHermesProfiles();
  });
}, 0);

async function syncRuntimeAliveStates() {
  const liveSessionsExist = sessions.some(
    (session) => sessionRuntimeState(session) === "live" && session.acpSessionId,
  );
  if (!liveSessionsExist) return;
  try {
    const providerIds = [...new Set(sessions
      .filter((session) => sessionRuntimeState(session) === "live" && session.acpSessionId)
      .map((session) => session.providerId))];
    const aliveByProvider = {};
    for (const providerId of providerIds) {
      const commands = acpCommandsForProvider(providerId);
      if (commands) aliveByProvider[providerId] = new Set(await invoke(commands.aliveIds));
    }
    let mutated = false;
    sessions.forEach((session) => {
      const declaredLive = sessionRuntimeState(session) === "live";
      const hasStartedRuntime = Boolean(session.acpSessionId);
      const aliveIds = aliveByProvider[session.providerId];
      if (declaredLive && hasStartedRuntime && aliveIds && !aliveIds.has(session.id)) {
        setSessionLifecycle(session, LIFECYCLE.resume_failed);
        activeSessionIds.delete(session.id);
        mutated = true;
      }
    });
    if (mutated) {
      renderWorkspace();
      renderHistory();
      setAppNotice("检测到 ACP runtime 已退出，相关会话已转为只读。", "error");
    }
  } catch (error) {
    console.error(error);
  }
}

setInterval(() => { void syncRuntimeAliveStates(); }, 15000);
