import {
  closeStreamingMarkdown,
  escapeHtml,
  isMarkdownTable,
  renderCodeFence,
  renderInlineMarkdown,
  renderMarkdownTable,
  renderMermaidDiagrams,
  renderRichText,
} from "./markdown/index.js";
import {
  normalizeSessionIdentity,
  normalizedSessionTitle,
  normalizedSessionTitleParts,
  runtimeDefaultsForProvider as identityRuntimeDefaultsForProvider,
  runtimeHostForInstance as identityRuntimeHostForInstance,
} from "./sessionIdentity.js";
import {
  createStickToBottomController,
  createStickToBottomRegistry,
  isAtBottom,
} from "./ui/stickToBottom.js";
import { createComposerController } from "./ui/composerController.js";
import { createAgentFleetView } from "./ui/agentFleetView.js";
import { createAgentManagementView } from "./ui/agentManagementView.js";
import { createRuntimeSessionCardView } from "./ui/runtimeSessionCardView.js";
import { createRuntimeSessionCardController } from "./ui/runtimeSessionCardController.js";
import { projectRuntimeSessionMessageList } from "./ui/runtimeSessionMessageListProjection.js";
import { createRuntimeSessionMessageListView } from "./ui/runtimeSessionMessageListView.js";
import {
  sessionCardStats,
  turnResponseText,
} from "./ui/sessionCardView.js";
import { createHistoryView } from "./ui/historyView.js";
import { createWorkspaceView } from "./ui/workspaceView.js";
import { renderAssistantResponse as renderAssistantResponseView } from "./ui/assistantResponseView.js";
import { renderProviderIcon, setAdapterIconRegistry } from "./ui/providerIcon.js";
import {
  LIFECYCLE,
} from "./state/sessionLifecycle.js";
import { createSessionRuntimeState } from "./state/sessionRuntimeState.js";
import { createSessionTurnState } from "./state/sessionTurnState.js";
import {
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
} from "./state/sessionListItems.js";
import {
  ACCESS_MODE,
  CARD_STATUS,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
  createRuntimeBinding,
  isRunningTurnStatus,
  resolveSessionCardStatusView,
} from "./state/sessionStatus.js";
import {
  canTargetStartSession,
  isStoppedHermesTarget,
  isTargetActivatable,
  isTargetSelectable,
  isTargetSendable,
} from "./state/targetActivation.js";
import { getAvailabilityStore } from "./state/availabilityStore.js";
import {
  acpCommandsForProvider as acpCommandsForProviderRaw,
} from "./runtime/acpCommands.js";
import { createAcpRuntimeClient } from "./runtime/acpRuntimeClient.js";
import {
  applyDataI18n,
  getLanguage,
  t,
  toggleLanguage as toggleLanguagePref,
} from "./i18n/index.js";
import {
  DEFAULT_THEME_ID,
  THEMES,
  findTheme,
  nextThemeId,
  registerUserThemes,
  themeLabel,
} from "./themes/index.js";
import {
  archivedSessionsFromHistory as archivedSessionsFromHistoryRaw,
} from "./history/entries.js";
import {
  buildHistoryEntryPayload,
} from "./history/payload.js";
import { createHistoryRepository } from "./history/historyRepository.js";
import { snapshotRuntimeSession } from "./providers/agentEntrySnapshot.js";
import { createProvidersStore } from "./state/providersStore.js";
import { createSessionsStore } from "./state/sessionsStore.js";
import { createWorkspaceViewStore } from "./state/workspaceViewStore.js";
import {
  projectSessionFromArchived,
  restoreAgentEntryFromArchived,
} from "./state/sessionRestoreProjection.js";
import { createWorkspaceSessionController } from "./controllers/workspaceSessionController.js";
import { createSessionRestoreController } from "./controllers/sessionRestoreController.js";
import { createSessionLifecycleController } from "./controllers/sessionLifecycleController.js";
import { createSessionExecutionController } from "./controllers/sessionExecutionController.js";
import { createSessionLaunchController } from "./controllers/sessionLaunchController.js";
import { createSessionPromptQueueController } from "./controllers/sessionPromptQueueController.js";
import {
  availableRuntimeInstancesForProvider as availableRuntimeInstancesForProviderRaw,
  providerRuntimeLabel as providerRuntimeLabelRaw,
  runtimeInstanceById as runtimeInstanceByIdRaw,
  runtimeInstancesForProvider as runtimeInstancesForProviderRaw,
  runtimeTargets as runtimeTargetsRaw,
  sortTargetsForAgentList,
  targetsForRuntimeInstance as targetsForRuntimeInstanceRaw,
} from "./providers/runtimeView.js";
import { providerSupportsLaunch } from "./providers/providerCatalog.js";
import {
  agentBriefTargetKey,
  briefRecordForTarget,
  explicitBriefText,
  fallbackBriefKeyForTarget,
  providerStatusForFleet,
  targetStatusForFleet,
} from "./providers/agentMetadata.js";
import { sessionSectionsFromEvents } from "./runtime/streamEvents.js";
import { FALLBACK_SESSIONS } from "./fixtures/fallbackSessions.js";

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
  0: "Starting",
  1: "Ready",
  2: "Thinking",
  3: "Using tools",
  4: "Responding",
  5: "Done",
  6: "Stopped",
  9: "Error",
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
  live: "Live",
  archived: "Read-only",
  restoring: "Reconnecting",
  resume_failed: "Reconnect failed",
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

const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const THEME_KEY = "lunaagentos.theme";
const PROVIDER_COLLAPSE_KEY = "lunaagentos.providerCollapsedIds";
const HISTORY_SCHEMA_VERSION = 5;
const STREAM_CARD_RENDER_INTERVAL_MS = 100;
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

function readCollapsedProviderIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROVIDER_COLLAPSE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function saveCollapsedProviderIds() {
  localStorage.setItem(PROVIDER_COLLAPSE_KEY, JSON.stringify([...collapsedProviderIds]));
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
const composer = promptBox?.closest(".composer");
const composerInputShell = document.getElementById("composerInputShell");
const composerAttachmentTray = document.getElementById("composerAttachmentTray");
const composerFileInput = document.getElementById("composerFileInput");
const attachBtn = document.getElementById("attachBtn");
const promptStats = document.getElementById("promptStats");
const newSessionToggle = document.getElementById("newSessionToggle");
const sendBtn = document.getElementById("sendBtn");
const sendModeBtn = document.getElementById("sendModeBtn");
const fontScaleBtn = document.getElementById("fontScaleBtn");
const themeBtn = document.getElementById("themeBtn");
const languageBtn = document.getElementById("languageBtn");
const confirmDialog = document.getElementById("confirmDialog");

localStorage.removeItem(CURRENT_SESSION_KEY);

let currentTargetAgentId = localStorage.getItem(CURRENT_TARGET_AGENT_KEY) || localStorage.getItem(LEGACY_TARGET_AGENT_KEY) || null;
const providersStore = createProvidersStore();
const sessionsStore = createSessionsStore();
const sessionRuntimeStateModel = createSessionRuntimeState({ sessionsStore });
const {
  canRestoreSession,
  canSendToSession,
  clearRuntimeBindingError,
  ensureSessionStatusShape,
  isSessionDeletedTombstone,
  isSessionStoppedTombstone,
  markSessionDeletedTombstone,
  sessionLifecycle,
  sessionRecordState,
  sessionRuntimeState,
  setRuntimeBinding,
  setSessionAccessMode,
  setSessionLifecycle,
  setSessionRecordState,
} = sessionRuntimeStateModel;
const sessionTurnStateModel = createSessionTurnState({
  sessionsStore,
  sessionRuntimeState: sessionRuntimeStateModel,
  translate: t,
});
const {
  appendRuntimeLog: appendRuntimeLogToSession,
  createTurn: createSessionTurn,
  markPromptError: markPromptErrorOnTurn,
  markStopped: markSessionStopped,
} = sessionTurnStateModel;
const acpRuntimeClient = createAcpRuntimeClient({
  invoke,
  commandsForProvider: acpCommandsForProvider,
  translate: t,
});
// History Repository 统一承接磁盘 IO 与快照管理，Shell 只注入运行时相关投影。
const historyRepository = createHistoryRepository({
  invoke,
  buildPayload: ({ session, turn }) => buildHistoryEntryPayload({
    session,
    turn,
    agentEntrySnapshot: snapshotRuntimeSession(session),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    runtimeState: sessionRuntimeState(session),
    getStateName: (state) => stateNames[state],
  }),
  projectArchivedSessions: (entries) => archivedSessionsFromHistoryRaw(entries, {
    normalizeSession: normalizeWorkspaceSession,
  }),
});
const workspaceViewStore = createWorkspaceViewStore();
let workspaceSessionController = null;
let sessionRestoreController = null;
let sessionLifecycleController = null;
let sessionExecutionController = null;
let sessionLaunchController = null;
let sessionPromptQueueController = null;
let composerController = null;
let agentFleetView = null;
let agentManagementView = null;
let runtimeSessionCardView = null;
let runtimeSessionCardController = null;
let historyView = null;
let workspaceView = null;
let sendAsNewSession = false;
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";
let themeId = localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID;
let runtimeConfigSnapshot = null;
let agentBriefs = {};
const sessionListSectionOpenState = {
  active: true,
  archive: true,
};
const collapsedProviderIds = new Set(readCollapsedProviderIds());
let scheduledWorkspaceRenderOptions = null;
let scheduledWorkspaceRenderFrame = 0;
let scheduledWorkspaceRenderTimer = 0;
let pendingConfirmAction = null;

function allAgents() {
  const dynamicTargets = runtimeTargets();
  return runtimeInstancesSnapshot().length ? dynamicTargets : providersSnapshot().flatMap((provider) => provider.agents);
}

function providersSnapshot() {
  return providersStore.getProvidersSnapshot();
}

// Session 列表按需读取快照，Shell 不长期持有 Store 内部数组。
function sessionsSnapshot() {
  return sessionsStore.getSessionsSnapshot();
}

function providerById(id) {
  return providersStore.providerById(id);
}

function runtimeInstancesSnapshot() {
  return providersStore.getRuntimeInstancesSnapshot();
}

function runtimeInstancesForProvider(providerId) {
  return runtimeInstancesForProviderRaw(runtimeInstancesSnapshot(), providerId);
}

function availableRuntimeInstancesForProvider(providerId) {
  return availableRuntimeInstancesForProviderRaw(runtimeInstancesSnapshot(), providerId);
}

function runtimeInstanceById(id) {
  return runtimeInstanceByIdRaw(runtimeInstancesSnapshot(), id);
}

function providerRuntimeLabel(provider, instance, availableCount) {
  return providerRuntimeLabelRaw(provider, instance, availableCount);
}

function runtimeHostForInstance(instance) {
  return identityRuntimeHostForInstance(instance);
}

function runtimeDefaultsForProvider(providerId, runtimeInstanceId = null) {
  return identityRuntimeDefaultsForProvider(providerId, runtimeInstanceId, runtimeInstancesSnapshot());
}

function targetDisplayName(target) {
  if (!target) return "";
  const provider = providerById(target.providerId);
  const providerName = target.providerName || provider?.name || "";
  if (target.kind === "profile") {
    return `${providerName}${target.runtimeLabel ? ` · ${target.runtimeLabel}` : ""} / ${displayAgentName(target)}`;
  }
  return target.name || providerName || displayAgentName(target);
}

function targetSendBlockNotice(target) {
  const targetName = targetDisplayName(target) || displayAgentName(target) || target?.providerName || "Agent";
  if (isStoppedHermesTarget(target)) {
    return t("composer.blockStoppedTarget", { target: targetName });
  }
  return t("composer.blockUnavailableTarget", { target: targetName });
}

function sessionIdentityTitle(session) {
  return normalizedSessionTitle(session, providersSnapshot());
}

function renderSessionIdentityTitle(session) {
  const parts = normalizedSessionTitleParts(session, providersSnapshot());
  const provider = providerById(session.providerId);
  const icon = renderProviderIcon(provider || { id: session.providerId, name: parts.providerName });
  return [
    `<span class="session-title-provider">${icon}${escapeHtml(parts.providerName)}</span>`,
    parts.runtimeLabel ? `<span class="session-title-runtime">${escapeHtml(parts.runtimeLabel)}</span>` : "",
    parts.targetName ? `<span class="session-title-target">${escapeHtml(parts.targetName)}</span>` : "",
  ].filter(Boolean).join("");
}

function targetsForRuntimeInstance(instance) {
  return targetsForRuntimeInstanceRaw(instance, {
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargetsByInstance: providersStore.getRuntimeTargetsByInstanceSnapshot(),
  });
}

function runtimeTargets() {
  return runtimeTargetsRaw({
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargetsByInstance: providersStore.getRuntimeTargetsByInstanceSnapshot(),
  });
}

function normalizeWorkspaceSession(session) {
  return normalizeSessionIdentity(session, {
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargets: runtimeTargets(),
  });
}

function archivedSessionsFromHistory() {
  return historyRepository.getArchivedSessions();
}

function targetsForProvider(providerId) {
  const provider = providerById(providerId);
  if (!providerSupportsLaunch(provider)) return [];
  const instances = runtimeInstancesForProvider(providerId);
  if (!instances.length) {
    return provider.agents || [];
  }
  return sortTargetsForAgentList(instances.flatMap(targetsForRuntimeInstance));
}

function compactTargetSubtitle(target) {
  if (!target) return "";
  const parts = [];
  if (target.gateway === "running") parts.push(t("availability.gatewayRunning"));
  else if (target.gateway) parts.push(t("availability.gatewayStopped"));
  else if (target.model) parts.push(target.model);
  return parts.filter(Boolean).join(" · ");
}

function providerMetaLabel(provider, targets, instances) {
  if (targets.length) {
    return t(provider.targetCountKey || "provider.targetCount", { count: targets.length });
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
  const currentTarget = agentById(currentTargetAgentId);
  if (currentTarget && isTargetSelectable(currentTarget)) return;
  const fallbackAgent = allAgents().find(isTargetSendable);
  if (fallbackAgent) {
    saveCurrentTargetAgent(fallbackAgent.id);
    return;
  }
  const activatableAgent = allAgents().find(isTargetActivatable);
  if (activatableAgent) {
    saveCurrentTargetAgent(activatableAgent.id);
  } else {
    saveCurrentTargetAgent(null);
  }
}

function agentById(id) {
  if (!id) return null;
  const runtimeTarget = runtimeTargets().find((agent) => agent.id === id);
  if (runtimeTarget) return runtimeTarget;
  const staticAgent = providersSnapshot().flatMap((provider) => provider.agents).find((agent) => agent.id === id);
  if (!staticAgent) return null;
  const managedByRuntimeProbe = runtimeInstancesForProvider(staticAgent.providerId).length > 0;
  if (managedByRuntimeProbe && !staticAgent.isArchivedAgent) return null;
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

function normalizedAgentBriefs(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function loadRuntimeConfigState() {
  const config = await invoke("load_runtime_config");
  runtimeConfigSnapshot = config || {};
  agentBriefs = normalizedAgentBriefs(runtimeConfigSnapshot.agentBriefs);
  return runtimeConfigSnapshot;
}

async function ensureRuntimeConfigState() {
  if (runtimeConfigSnapshot) return runtimeConfigSnapshot;
  return loadRuntimeConfigState();
}

async function saveAgentBriefRecords(nextBriefs) {
  const current = await invoke("load_runtime_config");
  const config = {
    ...(current || {}),
    agentBriefs: normalizedAgentBriefs(nextBriefs),
  };
  const saved = await invoke("save_runtime_config", { config });
  runtimeConfigSnapshot = saved || config;
  agentBriefs = normalizedAgentBriefs(runtimeConfigSnapshot.agentBriefs);
  return agentBriefs;
}

function cloneAgentBriefs() {
  return JSON.parse(JSON.stringify(normalizedAgentBriefs(agentBriefs)));
}

function targetBriefRecord(target, language = getLanguage()) {
  return briefRecordForTarget(agentBriefs, target, language);
}

function targetBriefText(target) {
  const record = targetBriefRecord(target);
  if (record?.text) return record.text;
  const explicit = explicitBriefText(target);
  if (explicit) return explicit;
  return t(fallbackBriefKeyForTarget(target));
}

function targetBriefInputValue(target, language) {
  return targetBriefRecord(target, language)?.text || "";
}

function writeBriefValue(nextBriefs, target, language, value, source = "manual") {
  const key = agentBriefTargetKey(target);
  if (!key) return;
  if (!nextBriefs[key] || typeof nextBriefs[key] !== "object") nextBriefs[key] = {};
  const text = String(value || "").trim();
  if (!text) {
    delete nextBriefs[key][language];
    if (!Object.keys(nextBriefs[key]).length) delete nextBriefs[key];
    return;
  }
  nextBriefs[key][language] = {
    text,
    source,
    updatedAt: new Date().toISOString(),
  };
}

function displayProviderNote(provider) {
  return provider?.noteKey ? t(provider.noteKey, provider.noteParams || {}) : provider?.note || "";
}

function currentTargetProvider() {
  return providerForAgent(currentTargetAgentId);
}

function acpCommandsForProvider(providerId) {
  if (!providerId) return null;
  return acpCommandsForProviderRaw(providerById(providerId));
}

function providerState(provider) {
  const instances = runtimeInstancesForProvider(provider.id);
  if (instances.length) {
    const availableCount = instances.filter((instance) => instance.available).length;
    if (availableCount === instances.length) return 1;
    if (availableCount > 0) return 2;
    return 9;
  }
  const availability = providersStore.getRuntimeAvailabilityFor(provider.id);
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
  return providersStore.getRuntimeAvailabilityFor(providerId) || { summary: "available", configured: true, available: true, command: "" };
}

function canSendToProvider(providerId) {
  if (!providerSupportsLaunch(providerById(providerId))) return false;
  if (runtimeInstancesForProvider(providerId).length) {
    return runtimeTargets().some((target) => target.providerId === providerId && canTargetStartSession(target));
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

function isArchivedSessionListItem(item) {
  return item?.record_state === RECORD_STATE.archived || item?.access_mode === ACCESS_MODE.read_only;
}

function isActiveSessionListItem(item) {
  return !isArchivedSessionListItem(item);
}

function isSessionExecuting(session) {
  return isRunningTurnStatus(session?.turns?.find((turn) => turn.id === session?.activeTurnId)?.status || session?.turns?.at(-1)?.status);
}

function formatBackendError(error) {
  const raw = String(error);
  const match = raw.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  if (!match) return raw;
  const [, code, message] = match;
  const label = t(`backend.${code}`);
  return `${label === `backend.${code}` ? code : label}: ${message}`;
}

function compactNoticeText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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
  document.title = t("app.title");
  if (providerManagerBtn) providerManagerBtn.textContent = t("availability.button");
  if (languageBtn) languageBtn.textContent = t("topbar.language");
  applyFontScale();
  applyTheme();
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

function openConfirmDialog({ title, message, confirmLabel = t("common.delete"), onConfirm }) {
  if (!confirmDialog) return;
  pendingConfirmAction = onConfirm;
  confirmDialog.hidden = false;
  confirmDialog.innerHTML = `
    <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
      <div class="confirm-dialog-header">
        <span class="confirm-dialog-icon" aria-hidden="true">!</span>
        <h3 id="confirmDialogTitle">${escapeHtml(title)}</h3>
        <button type="button" class="confirm-dialog-close" aria-label="${t("common.close")}">×</button>
      </div>
      <p class="confirm-dialog-message">${escapeHtml(message)}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="mini-btn confirm-dialog-cancel">${t("common.cancel")}</button>
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
  composerController?.updateActionLabels();
}

function updatePromptPlaceholder() {
  composerController?.updatePromptPlaceholder();
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

function toggleProviderCollapsed(providerId) {
  if (!providerId) return;
  if (collapsedProviderIds.has(providerId)) {
    collapsedProviderIds.delete(providerId);
  } else {
    collapsedProviderIds.add(providerId);
  }
  saveCollapsedProviderIds();
  renderProviders();
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

function isComposingNewSession() {
  return sendAsNewSession || !currentSession();
}

function currentComposerTargetLabel() {
  const session = currentSession();
  if (session && !isComposingNewSession()) {
    return sessionIdentityTitle(normalizeWorkspaceSession(session));
  }
  const agent = currentTargetAgent();
  return agent ? targetDisplayName(agent) : "";
}

function currentSessionSendBlockReason(session, agent) {
  if (!session) return "";
  if (agent && session.agentId !== agent.id) return t("composer.blockInactiveSession");
  if (canSendToSession(session)) return "";
  return t("composer.blockInactiveSession");
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

function currentTheme() {
  return findTheme(themeId) || findTheme(DEFAULT_THEME_ID) || THEMES[0];
}

function applyTheme() {
  const theme = currentTheme();
  if (!theme) return;
  const root = document.documentElement;
  const vars = theme.vars || {};
  Object.entries(vars).forEach(([name, value]) => {
    if (name && value !== undefined && value !== null) {
      root.style.setProperty(name, String(value));
    }
  });
  if (theme.colorScheme) {
    root.style.setProperty("color-scheme", theme.colorScheme);
  }
  root.classList.toggle("theme-dark", theme.colorScheme === "dark");
  root.classList.toggle("theme-light", theme.colorScheme !== "dark");
  root.dataset.theme = theme.id;
  if (themeBtn) {
    themeBtn.textContent = t("topbar.theme", { name: themeLabel(theme, getLanguage()) });
  }
}

function cycleTheme() {
  themeId = nextThemeId(themeId);
  localStorage.setItem(THEME_KEY, themeId);
  applyTheme();
}

// Pull user-supplied themes from ~/.lunaagentos/themes/*.json via the
// Tauri backend, merge them into the registry, and re-apply the active
// theme so a persisted user-theme id picks up its real values instead
// of falling back to the default. Failures are non-fatal: the built-in
// theme set continues to work.
async function loadUserThemes() {
  if (typeof invoke !== "function") return;
  try {
    const userThemes = await invoke("load_user_themes");
    if (Array.isArray(userThemes) && userThemes.length) {
      registerUserThemes(userThemes);
      applyTheme();
    }
  } catch (error) {
    console.warn("load_user_themes failed", error);
  }
}

async function loadAdapterIcons(adapters) {
  if (typeof invoke !== "function") return;
  const iconEntries = {};
  await Promise.all(
    (Array.isArray(adapters) ? adapters : []).map(async (adapter) => {
      if (!adapter?.id || !adapter?.iconPath) return;
      try {
        const payload = await invoke("read_adapter_icon", { adapterId: adapter.id });
        if (payload?.mime && payload?.base64) {
          iconEntries[adapter.id] = `data:${payload.mime};base64,${payload.base64}`;
        }
      } catch (error) {
        console.warn("read_adapter_icon failed", adapter.id, error);
      }
    }),
  );
  setAdapterIconRegistry(iconEntries);
}

function updateSendModeLabel() {
  composerController?.updateSendModeLabel();
}

function agentBriefPrompt() {
  return [
    "请用10个字以内给自己起一个普通用户一眼能看懂的职责标题。只返回标题，不要解释，不要标点。",
    "Give yourself a clear role title in 4 words or fewer. Return only the title. No punctuation.",
    "Return both titles in strict JSON only.",
    "Return strict JSON only: {\"zh-CN\":\"...\",\"en-US\":\"...\"}",
  ].join("\n");
}

function sanitizeBriefText(value, language) {
  const text = String(value || "")
    .replace(/^[`"“”'‘’\s]+|[`"“”'‘’\s]+$/g, "")
    .replace(/[。.!！?？,，;；:：]+$/g, "")
    .trim();
  if (!text) return "";
  if (language === "en-US") return text.split(/\s+/).slice(0, 4).join(" ");
  return Array.from(text).slice(0, 10).join("");
}

function parseAgentBriefResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error(t("agentBrief.emptyResponse"));
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  const parsed = JSON.parse(jsonText);
  const zh = sanitizeBriefText(parsed["zh-CN"] || parsed.zh || parsed.zhCN, "zh-CN");
  const en = sanitizeBriefText(parsed["en-US"] || parsed.en || parsed.enUS, "en-US");
  if (!zh || !en) throw new Error(t("agentBrief.invalidResponse"));
  return { "zh-CN": zh, "en-US": en };
}

async function fetchAgentBriefForTarget(target) {
  if (!target || !isTargetSendable(target)) throw new Error(t("agentBrief.targetUnavailable"));
  const commands = acpCommandsForProvider(target.providerId);
  if (!commands?.prompt) throw new Error(t("agentBrief.autoUnsupported"));
  const prompt = agentBriefPrompt();
  const session = createSessionForAgent(target, prompt);
  if (!session) throw new Error(t("agentBrief.autoUnsupported"));
  saveCurrentTargetAgent(target.id);
  saveCurrentSession(session.id);
  sessionsStore.unmarkStopped(session.id);
  const turn = createTurn(session, prompt);
  closeConfirmDialog();
  renderProviders();
  renderWorkspace({ scrollSessionId: session.id });
  renderHistory({ scrollSessionId: session.id });
  await startAcpSession(session, turn);
  const response = turn.finalResponse || turn.outputs.join("\n");
  return parseAgentBriefResponse(response);
}

async function refreshAgentBriefForTarget(target, { quiet = false } = {}) {
  if (!target) return null;
  if (!quiet) setAppNotice(t("agentBrief.fetching", { target: targetDisplayName(target) }), "busy");
  const result = await fetchAgentBriefForTarget(target);
  const next = cloneAgentBriefs();
  writeBriefValue(next, target, "zh-CN", result["zh-CN"], "agent-session");
  writeBriefValue(next, target, "en-US", result["en-US"], "agent-session");
  await saveAgentBriefRecords(next);
  renderProviders();
  if (!quiet) setAppNotice(t("agentBrief.fetched", { target: targetDisplayName(target) }));
  return result;
}

// Shell 只保留弹窗命令入口，具体 HTML 和表单绑定由 Agent 管理视图负责。
async function openAgentManager(agentId) {
  return agentManagementView?.openAgentManager(agentId);
}

async function openProviderManager(providerId = currentTargetProvider()?.id || providersSnapshot()[0]?.id || "") {
  return agentManagementView?.openProviderManager(providerId);
}

function openAvailabilityModal() {
  agentManagementView?.openAvailabilityModal();
}

async function refreshRuntimeProbe() {
  try {
    const adapterResult = await invoke("load_adapters");
    const adapters = adapterResult?.adapters || [];
    await loadAdapterIcons(adapters);
    const result = await invoke("runtime_probe");
    providersStore.batch(() => {
      providersStore.syncAdapterProviders(adapters);
      providersStore.patchRuntimeAvailability(
        Object.fromEntries((result?.providers || []).map((item) => [item.providerId, item])),
      );
      providersStore.replaceRuntimeInstances(Array.isArray(result?.instances) ? result.instances : []);
      const probedInstances = runtimeInstancesSnapshot();
      providersStore.pruneRuntimeTargetsByInstanceIds(
        probedInstances.filter((instance) => instance.available).map((instance) => instance.id),
      );
    });
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspace();
    renderHistory();
    renderWorkspaceStatus();
    const probedInstances = runtimeInstancesSnapshot();
    getAvailabilityStore().refresh(providersSnapshot(), probedInstances, currentTargetAgent(), providersStore.getRuntimeAvailabilitySnapshot());
    [...new Set(probedInstances.filter((instance) => instance.available).map((instance) => instance.providerId))]
      .forEach((providerId) => {
        loadRuntimeSlashCommandsForProvider(providerId);
      });
    return result;
  } catch (error) {
    console.error(error);
    setAppNotice(t("runtime.probeFailed", { error: formatBackendError(error) }), "error");
    return null;
  }
}

// 连接弹窗重查时统一刷新探测结果和该 Provider 的目标列表。
async function refreshProviderConnections(providerId) {
  await refreshRuntimeProbe();
  await loadRuntimeTargetsForProvider(providerId);
}

function latestActiveSessionForAgent(agentId) {
  return sessionsSnapshot()
    .filter((session) => session.agentId === agentId && sessionsStore.isSessionActive(session.id) && canSendToSession(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

function setCurrentTargetAgent(agentId) {
  const target = agentById(agentId);
  if (!isTargetSelectable(target)) {
    setAppNotice(targetSendBlockNotice(target), "error");
    renderProviders();
    updateActionLabels();
    return;
  }
  const previousSession = currentSession();
  saveCurrentTargetAgent(agentId);
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  if (previousSession && previousSession.agentId !== agentId) {
    saveCurrentSession(null);
    sendAsNewSession = true;
  } else if (!currentSession()) {
    sendAsNewSession = true;
  }
  updateActionLabels();
  if (agent && provider) {
    renderWorkspaceStatus();
    setAppNotice(t("target.switched", { target: targetDisplayName(agent) }));
  }
  renderProviders();
  renderWorkspace();
  renderHistory();
  focusComposerInput();
}

function runtimeConnectionNote(provider, instances) {
  if (!providerSupportsLaunch(provider)) return displayProviderNote(provider);
  if (!instances.length) {
    return t(provider.noRuntimeKey || "provider.noRuntime");
  }
  const available = instances.filter((instance) => instance.available);
  if (!available.length) return t(provider.noRuntimeKey || "provider.noRuntime");
  return available
    .map((instance) => instance.runtimeLabel || provider.name)
    .join(" / ");
}

// Shell 只保留重绘入口，具体 Fleet HTML 与点击绑定由视图模块负责。
function renderProviders() {
  agentFleetView?.renderProviders();
}

function applyRuntimeTargetsForInstance(providerId, runtimeInstanceId, targets) {
  providersStore.batch(() => {
    providersStore.setRuntimeTargetsForInstance(runtimeInstanceId, targets);
    const count = providersStore.totalRuntimeTargetCount();
    const provider = providerById(providerId);
    if (provider?.loadedTargetsNoteKey && count > 0) {
      providersStore.setProviderNote(providerId, {
        note: null,
        noteKey: provider.loadedTargetsNoteKey,
        noteParams: { count },
      });
    }
  });
}

function mergeSlashCommands(commands) {
  const byKey = new Map();
  for (const command of Array.isArray(commands) ? commands : []) {
    if (!command?.name) continue;
    const key = command.name;
    if (!byKey.has(key)) byKey.set(key, command);
  }
  return [...byKey.values()];
}

async function loadRuntimeSlashCommandsForProvider(providerId, runtimeInstanceIds = null) {
  const instances = (runtimeInstanceIds || availableRuntimeInstancesForProvider(providerId).map((instance) => instance.id))
    .map(runtimeInstanceById)
    .filter(Boolean)
    .filter((instance) => instance.available);
  if (!instances.length) return;
  try {
    const discovered = [];
    for (const instance of instances) {
      const commands = await invoke("runtime_adapter_slash_commands", {
        adapterId: providerId,
        runtimeInstanceId: instance.id,
      });
      discovered.push(...(Array.isArray(commands) ? commands : []));
    }
    providersStore.setSlashCommandsForProvider(providerId, mergeSlashCommands(discovered));
    composerController?.refreshCommands();
  } catch (error) {
    console.error(error);
  }
}

async function loadRuntimeTargetsForProvider(providerId, runtimeInstanceIds = null) {
  const instances = (runtimeInstanceIds || availableRuntimeInstancesForProvider(providerId).map((instance) => instance.id))
    .map(runtimeInstanceById)
    .filter(Boolean)
    .filter((instance) => instance.available);
  if (!instances.length) return;
  try {
    let loaded = 0;
    for (const instance of instances) {
      const targets = await invoke("runtime_adapter_targets", {
        adapterId: providerId,
        runtimeInstanceId: instance.id,
      });
      applyRuntimeTargetsForInstance(providerId, instance.id, targets);
      loaded += Array.isArray(targets) ? targets.length : 0;
    }
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspace();
    const emptyNoticeKey = providerById(providerId)?.emptyTargetsNoticeKey;
    if (!loaded && emptyNoticeKey) setAppNotice(t(emptyNoticeKey));
  } catch (error) {
    console.error(error);
    setAppNotice(t("provider.runtimeTargetLoadFailed", { error: formatBackendError(error) }), "error");
  }
}

// Agent Brief 与 Composer 共用同一条 Session 创建路径。
function createSessionForAgent(agent, firstTask) {
  return sessionLaunchController?.createSessionForAgent(agent, firstTask) || null;
}

// Agent Brief 与 Composer 共用同一条 Turn 创建路径。
function createTurn(session, task, options = {}) {
  return sessionLaunchController?.createTurn(session, task, options) || null;
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
  const liveIds = new Set(sessionsSnapshot().map((session) => session.id));
  return archivedSessionsFromHistory()
    .filter((item) => !liveIds.has(item.id))
    .filter((item) => item.record_state === RECORD_STATE.active && item.access_mode !== ACCESS_MODE.read_only)
    .length;
}

function renderWorkspaceStatus() {
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  const countedSessions = sessionsSnapshot();
  const liveCount = countedSessions.filter((session) => sessionRecordState(session) === RECORD_STATE.active).length;
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





function isSessionLatestOnly(session) {
  return sessionsStore.isLatestOnly(session.id);
}

function toggleSessionLatestOnly(sessionId) {
  const session = sessionsStore.getSession(sessionId);
  if (!session) return;
  sessionsStore.setLatestOnly(sessionId, !isSessionLatestOnly(session));
  renderWorkspace();
}

function renderAssistantResponse(text, phase = "final") {
  return renderAssistantResponseView(text, phase, {
    closeStreamingMarkdown,
    escapeHtml,
    renderRichText,
    t,
  });
}

function sessionTranscriptText(session) {
  return session.turns.map((turn, index) => turnTranscriptText(turn, index)).join("\n\n---\n\n");
}

function turnTranscriptText(turn, index) {
  const parts = [
    `# ${t("turn.transcriptTitle", { index: index + 1 })}`,
    `user:\n${turn.task}`,
  ];
  if (turn.thoughts.length) parts.push(`${t("turn.thoughtStreamLabel")}:\n${turn.thoughts.join("\n\n")}`);
  const response = turnResponseText(turn);
  if (response) parts.push(`assistant:\n${response}`);
  if (turn.logs.length) parts.push(`${t("turn.runtimeStreamLabel")}:\n${turn.logs.join("\n")}`);
  return parts.join("\n\n");
}

function renderSessionActionIcon(name) {
  const icons = {
    // 移出工作台 — LogOut（门 + 向右箭头），明确"离开/移出"语义
    dismiss: `<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"></path><path d="m15 8 4 4-4 4"></path><path d="M19 12H10"></path>`,
    // 归档 — 标准 Archive 抽屉
    archive: `<rect x="3" y="4" width="18" height="5" rx="1"></rect><path d="M5 9v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"></path><path d="M10 13h4"></path>`,
    // 停止运行 — 实心方块
    stop: `<rect x="7" y="7" width="10" height="10" rx="1.5"></rect>`,
    // 删除 — 垃圾桶（保留）
    delete: `<path d="M4 7h16"></path><path d="M10 11v5"></path><path d="M14 11v5"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path>`,
    // 复制 — 双方块（保留）
    copy: `<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>`,
    // 仅显示最新一轮 — 高亮顶部一条 + 其他半透明（视觉上一目了然"只看一条"）
    latest: `<path d="M5 7h14"></path><path opacity="0.3" d="M5 12h14"></path><path opacity="0.3" d="M5 17h14"></path>`,
    // 显示全部轮次 — 三条横线同色
    all: `<path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path>`,
    // 滚到最新内容 — 圆框 + 向下箭头（与 dismiss/expand 视觉区分）
    latestScroll: `<circle cx="12" cy="12" r="9"></circle><path d="M12 8v7"></path><path d="m8 11 4 4 4-4"></path>`,
    // 全屏（保留）
    fullscreen: `<path d="M8 4H4v4"></path><path d="M16 4h4v4"></path><path d="M20 16v4h-4"></path><path d="M4 16v4h4"></path>`,
    // 退出全屏（保留）
    fullscreenExit: `<path d="M9 4v5H4"></path><path d="M15 4v5h5"></path><path d="M20 15h-5v5"></path><path d="M4 15h5v5"></path>`,
  };
  return `
    <svg class="session-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      ${icons[name] || icons.copy}
    </svg>
  `;
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

function isFlowDetailOpen(key, defaultOpen) {
  return sessionsStore.getFlowDetailOpen(key, defaultOpen);
}

// MessageList View 负责稳定 DOM 对账；Shell 只注入 Markdown 与详情展开查询。
const runtimeSessionMessageListView = createRuntimeSessionMessageListView({
  renderAssistantResponse,
  isOpenForKey: isFlowDetailOpen,
  t,
  escapeHtml,
});

// Shell 只暴露 Session Card 渲染入口，HTML 结构由独立视图负责。
function renderSessionCard(session) {
  return runtimeSessionCardView.renderSessionCard(session);
}

function focusSessionInWorkspace(sessionId) {
  return workspaceSessionController?.focusSessionInWorkspace(sessionId) || false;
}

function toggleSessionFocus(sessionId) {
  workspaceSessionController?.toggleSessionFocus(sessionId);
}

function renderSessionMiniCard(session) {
  return runtimeSessionCardView.renderSessionMiniCard(session);
}

function exitFullscreenSessions() {
  return workspaceSessionController?.exitFullscreenSessions() || false;
}

function bindSessionActions(root = sessionDeck) {
  runtimeSessionCardController?.bindSessionActions(root);
}

function activateWorkspaceSession(sessionId, options = {}) {
  const activated = workspaceSessionController?.activateWorkspaceSession(sessionId, options);
  if (activated) sendAsNewSession = false;
}

function focusComposerInput() {
  if (!promptBox) return;
  if (document.activeElement === promptBox) return;
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
    return;
  }
  requestAnimationFrame(() => {
    try {
      promptBox.focus({ preventScroll: true });
    } catch (_) {
      promptBox.focus();
    }
  });
}

// Runtime Session Card View 只消费状态投影和命令查询，不直接修改 Session Store。
runtimeSessionCardView = createRuntimeSessionCardView({
  ensureSessionStatusShape,
  normalizeWorkspaceSession,
  resolveSessionCardStatusView,
  getCurrentSessionId: () => sessionsStore.getCurrentSessionId(),
  getFocusedSessionId: () => workspaceViewStore.getFocusedSessionId(),
  projectRuntimeSessionMessageList,
  runtimeSessionMessageListView,
  sessionCardStats,
  isSessionLatestOnly,
  sessionIdentityTitle,
  renderSessionIdentityTitle,
  renderSessionActionIcon,
  canRestoreSession,
  CARD_STATUS,
  RUNTIME_BINDING_STATE,
  RECORD_STATE,
  ACCESS_MODE,
  t,
  escapeHtml,
});

// Runtime Session Card Controller 接管动作绑定、流式局部刷新和滚动粘连。
runtimeSessionCardController = createRuntimeSessionCardController({
  sessionDeck,
  sessionStickRegistry,
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  renderSessionCard,
  buildSessionCardViewModel: (session) => runtimeSessionCardView.buildSessionCardViewModel(session),
  projectRuntimeSessionMessageList,
  runtimeSessionMessageListView,
  isSessionLatestOnly,
  renderMermaidDiagrams,
  scheduleWorkspaceRender,
  focusSessionInWorkspace,
  activateWorkspaceSession,
  toggleSessionFocus,
  dismissWorkspaceSession,
  archiveLiveSession,
  stopSession,
  requestDeleteConfirmation,
  restoreArchivedSession,
  setFlowDetailOpen: (key, open) => sessionsStore.setFlowDetailOpen(key, open),
  sessionTranscriptText,
  copyTextToClipboard,
  toggleSessionLatestOnly,
  setAppNotice,
  isAtBottom,
  t,
  streamRenderIntervalMs: STREAM_CARD_RENDER_INTERVAL_MS,
});

// Agent Management View 统一承接连接详情、职责简报和可用性弹窗。
agentManagementView = createAgentManagementView({
  confirmDialog,
  getAvailabilityStore,
  providersSnapshot,
  runtimeInstancesSnapshot,
  getRuntimeAvailabilitySnapshot: () => providersStore.getRuntimeAvailabilitySnapshot(),
  currentTargetAgent,
  getDefaultProviderId: () => currentTargetProvider()?.id || providersSnapshot()[0]?.id || "",
  providerById,
  agentById,
  runtimeInstanceById,
  runtimeInstancesForProvider,
  targetsForProvider,
  providerAvailability,
  providerAvailabilityLabel,
  providerAvailabilityState: (summary) => PROVIDER_AVAILABILITY_STATES[summary]?.state,
  runtimeConnectionNote,
  targetDisplayName,
  displayAgentName,
  targetBriefText,
  targetBriefInputValue,
  fallbackBriefKeyForTarget,
  isTargetSendable,
  cloneAgentBriefs,
  writeBriefValue,
  saveAgentBriefRecords,
  ensureRuntimeConfigState,
  refreshAgentBriefForTarget,
  refreshRuntimeProbe,
  refreshProviderConnections,
  renderProviders,
  closeConfirmDialog,
  setAppNotice,
  formatBackendError,
  stateClasses,
  t,
  escapeHtml,
});

// Agent Fleet View 接管左侧列表 HTML 与点击绑定，Shell 只注入领域查询和命令。
agentFleetView = createAgentFleetView({
  agentList,
  providersSnapshot,
  ensureCurrentTargetAgentExists,
  providerAvailability,
  providerStatusForFleet,
  runtimeInstancesForProvider,
  targetsForProvider,
  providerMetaLabel,
  providerRuntimeMiniLabel,
  renderProviderIcon,
  targetBriefText,
  displayAgentName,
  targetStatusForFleet,
  targetSendBlockNotice,
  isTargetSendable,
  isTargetActivatable,
  isTargetSelectable,
  agentById,
  getCurrentTargetAgentId: () => currentTargetAgentId,
  collapsedProviderIds,
  toggleProviderCollapsed,
  openProviderManager,
  openAgentManager,
  setCurrentTargetAgent,
  setAppNotice,
  t,
  escapeHtml,
});

workspaceSessionController = createWorkspaceSessionController({
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  workspaceViewStore,
  saveCurrentTargetAgent,
  saveCurrentSession,
  canSendToSession,
  markSessionActive,
  updateActionLabels,
  renderProviders,
  renderWorkspace,
  renderHistory,
  sessionRuntimeState,
  setAppNotice,
  focusComposerInput,
  t,
});

historyView = createHistoryView({
  historyList,
  sessionListSectionOpenState,
  sessionListItems,
  isHistoryLoading: () => historyRepository.isLoading(),
  isActiveSessionListItem,
  isArchivedSessionListItem,
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
  ensureSessionStatusShape,
  resolveSessionCardStatusView,
  CARD_STATUS,
  canSendToSession,
  sessionsStore,
  t,
  escapeHtml,
  renderProviderIcon,
  providerById,
  renderSessionActionIcon,
  formatTime,
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  setWorkspaceVisibility: (sessionId, visible) => sessionsStore.setWorkspaceVisibility(sessionId, visible),
  requestDeleteConfirmation,
  restoreArchivedSession,
  activateWorkspaceSession,
  openArchivedTranscript,
});
// Repository 快照变化时刷新右侧列表，包含加载态切换与后台写入结果。
historyRepository.subscribe(() => renderHistory());

workspaceView = createWorkspaceView({
  sessionDeck,
  workspaceEmpty,
  getSessionsSnapshot: sessionsSnapshot,
  workspaceViewStore,
  updatePromptPlaceholder,
  renderWorkspaceStatus,
  updateWorkspaceEmptyCopy,
  renderSessionCard,
  renderSessionMiniCard,
  bindSessionActions,
  renderMermaidDiagrams,
  sampleSessionStickyIntent,
  syncSessionStickControllers,
  getCurrentSessionId: () => sessionsStore.getCurrentSessionId(),
  t,
  escapeHtml,
});

// Session Lifecycle Controller 接管 Runtime、History 与工作区清理的联动。
sessionLifecycleController = createSessionLifecycleController({
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  getArchivedSession: (sessionId) => archivedSessionsFromHistory().find((item) => item.id === sessionId) || null,
  getCurrentSessionId: () => sessionsStore.getCurrentSessionId(),
  sessionRuntimeState,
  isSessionExecuting,
  setSessionLifecycle,
  markSessionDeletedTombstone,
  markSessionStopped,
  acpRuntimeClient,
  historyRepository,
  saveTurnToHistory,
  removeSessionById: (sessionId) => sessionsStore.removeSessionById(sessionId),
  setWorkspaceVisibility: (sessionId, visible) => sessionsStore.setWorkspaceVisibility(sessionId, visible),
  markSessionInactive,
  clearCurrentSessionIf,
  clearScheduledWorkspaceFocus: (sessionId) => {
    if (scheduledWorkspaceRenderOptions?.focusSessionId === sessionId) {
      scheduledWorkspaceRenderOptions = { ...scheduledWorkspaceRenderOptions, focusSessionId: null };
    }
  },
  clearQueuedSubmissions: (session, reason) => sessionPromptQueueController?.clear(session, reason),
  renderProviders,
  renderWorkspace,
  renderHistory,
  openConfirmDialog,
  formatBackendError,
  setAppNotice,
  t,
});

async function archiveLiveSession(sessionId) {
  return sessionLifecycleController?.archiveLiveSession(sessionId);
}

async function stopSession(sessionId) {
  return sessionLifecycleController?.stopSession(sessionId);
}

async function dismissWorkspaceSession(sessionId) {
  return sessionLifecycleController?.dismissWorkspaceSession(sessionId);
}

function requestDeleteConfirmation(sessionId) {
  sessionLifecycleController?.requestDeleteConfirmation(sessionId);
}

function renderWorkspace(options = {}) {
  workspaceView?.renderWorkspace(options);
}

function sampleSessionStickyIntent() {
  return runtimeSessionCardController?.sampleSessionStickyIntent() || new Map();
}

function scheduleSessionCardRender(sessionId) {
  runtimeSessionCardController?.scheduleSessionCardRender(sessionId);
}

function syncSessionStickControllers(visibleSessions, stickyIntent) {
  runtimeSessionCardController?.syncSessionStickControllers(visibleSessions, stickyIntent);
}

function sessionListItems() {
  const sourceSessions = sessionsSnapshot();
  const liveItems = sourceSessions.map((session) => {
    ensureSessionStatusShape(session);
    const identitySession = normalizeWorkspaceSession(session);
    const lastTurn = session.turns.at(-1);
    const inWorkspace = session.inWorkspace !== false;
    return {
      id: session.id,
      date: session.createdAt.slice(0, 10),
      createdAt: session.createdAt,
      updatedAt: lastTurn?.createdAt || session.createdAt,
      providerId: identitySession.providerId,
      providerName: identitySession.providerName,
      agentName: identitySession.agentName,
      title: session.task || t("history.newSession"),
      summary: lastTurn?.finalResponse || lastTurn?.outputs.at(-1) || lastTurn?.logs.at(-1) || t("session.current"),
      turnCount: session.turns.length,
      runtimeState: sessionRuntimeState(session),
      record_state: session.record_state,
      access_mode: session.access_mode,
      runtime_binding: session.runtime_binding,
      turns: session.turns,
      activeTurnId: session.activeTurnId || null,
      agentId: identitySession.agentId,
      runtimeInstanceId: identitySession.runtimeInstanceId || null,
      targetId: identitySession.targetId || identitySession.agentId,
      acpSessionId: session.acpSessionId || null,
      // Display flag: only sessions actually shown in the workspace get the "in workspace" pill.
      // A dismissed-but-still-live session keeps its runtimeState (live/restoring/...) so the
      // history list reflects the real runtime status; the runtime keeps running in the background.
      isInWorkspace: inWorkspace,
      isRuntimeAttached: true,
    };
  });
  const liveIds = new Set(liveItems.map((item) => item.id));
  const historyItems = archivedSessionsFromHistory()
    .filter((item) => !liveIds.has(item.id))
    .map((item) => ({
      ...item,
      runtimeState: item.runtimeState || "archived",
      record_state: item.record_state || RECORD_STATE.archived,
      access_mode: item.access_mode || ACCESS_MODE.read_only,
      runtime_binding: item.runtime_binding || createRuntimeBinding(),
      isInWorkspace: false,
      isRuntimeAttached: false,
    }));
  return [...liveItems, ...historyItems];
}

function renderHistory(options = {}) {
  historyView?.renderHistory(options);
}

function ensureArchivedAgent(agentEntry) {
  const provider = providerById(agentEntry.providerId) || providersSnapshot()[0];
  let agent = agentById(agentEntry.id);
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
    providersStore.appendProviderAgent(provider.id, agent);
  }
  // 仅回填缺失字段，避免旧归档覆盖当前实时探测结果。
  Object.entries(agentEntry).forEach(([key, value]) => {
    if (agent[key] == null && value != null) agent[key] = value;
  });
  return agent;
}

function workspaceSessionFromArchived(archived, existing = null) {
  const agentEntries = [...runtimeTargets(), ...providersSnapshot().flatMap((provider) => provider.agents || [])];
  const restoredAgent = ensureArchivedAgent(restoreAgentEntryFromArchived(archived, agentEntries));
  return projectSessionFromArchived(archived, {
    existing,
    agentEntry: restoredAgent,
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeDefaultsForProvider,
    runtimeHostForInstance,
    normalizeSession: normalizeWorkspaceSession,
    ensureSessionStatusShape,
  });
}

// Session Restore Controller 接管归档打开、重连与首轮异常回退。
sessionRestoreController = createSessionRestoreController({
  getArchivedSessions: archivedSessionsFromHistory,
  getSessionsSnapshot: sessionsSnapshot,
  getCurrentSessionId: () => sessionsStore.getCurrentSessionId(),
  workspaceSessionFromArchived,
  sessionRuntimeState,
  setSessionRecordState,
  setSessionAccessMode,
  setSessionLifecycle,
  setRuntimeBinding,
  clearRuntimeBindingError,
  markSessionInactive,
  markSessionActive,
  upsertSession: (session) => sessionsStore.upsertHead(session),
  unmarkStopped: (sessionId) => sessionsStore.unmarkStopped(sessionId),
  saveCurrentTargetAgent,
  saveCurrentSession,
  activateWorkspaceSession,
  renderProviders,
  renderWorkspace,
  renderHistory,
  focusComposerInput,
  acpRuntimeClient,
  appendRuntimeLog: appendRuntimeLogToSession,
  markPromptError: markPromptErrorOnTurn,
  formatBackendError,
  compactNoticeText,
  setAppNotice,
  t,
});

function openArchivedTranscript(sessionId) {
  return sessionRestoreController?.openArchivedTranscript(sessionId);
}

async function restoreArchivedSession(sessionId) {
  return sessionRestoreController?.restoreArchivedSession(sessionId);
}

async function loadHistory() {
  try {
    const { notice } = await historyRepository.load();
    if (notice) setAppNotice(notice.message, notice.kind);
  } catch (error) {
    console.error(error);
    setAppNotice(t("history.loadFailed"), "error");
  }
  renderHistory();
}

async function saveTurnToHistory(session, turn) {
  await historyRepository.appendTurn({ session, turn });
  renderHistory();
}

// Session Execution Controller 接管 ACP、fallback、流式事件和错误落盘。
sessionExecutionController = createSessionExecutionController({
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  getAgent: agentById,
  getAdapterCapabilities: (providerId) => providerById(providerId)?.adapterManifest?.capabilities || {},
  fallbackSessions: FALLBACK_SESSIONS,
  acpRuntimeClient,
  sessionTurnState: sessionTurnStateModel,
  sessionRuntimeState: sessionRuntimeStateModel,
  saveTurnToHistory,
  rollbackFirstTurnPromptFailure: (session, turn, message) => (
    sessionRestoreController?.rollbackFirstTurnPromptFailure(session, turn, message)
  ),
  refreshRuntimeTargets: loadRuntimeTargetsForProvider,
  renderProviders,
  renderWorkspace,
  renderHistory,
  scheduleSessionCardRender,
  updateActionLabels,
  formatBackendError,
  setAppNotice,
  t,
  pumpFollowUpQueue: (session) => sessionPromptQueueController?.pump(session),
  requestFrame: () => new Promise((resolve) => requestAnimationFrame(resolve)),
});

async function runFallbackSession(session, turn) {
  return sessionExecutionController?.runFallbackSession(session, turn);
}

async function startAcpSession(session, turn) {
  return sessionExecutionController?.startAcpSession(session, turn);
}

// 后续输入队列只负责串行化 Prompt Run；具体 Runtime 路由仍由 Shell 注入。
sessionPromptQueueController = createSessionPromptQueueController({
  createSessionTurn,
  dispatchPromptRun: (session, turn) => {
    if (acpCommandsForProvider(session.providerId)) {
      void startAcpSession(session, turn);
    } else {
      void runFallbackSession(session, turn);
    }
  },
  renderWorkspace,
  renderHistory,
  setAppNotice,
  t,
});

// Composer Controller 接管输入交互、附件与斜杠菜单，Shell 只注入领域回调。
composerController = createComposerController({
  promptBox,
  composer,
  composerInputShell,
  composerAttachmentTray,
  composerFileInput,
  attachBtn,
  promptStats,
  newSessionToggle,
  sendBtn,
  sendModeBtn,
  getCurrentTargetProvider: currentTargetProvider,
  getSlashCommandsForProvider: (providerId) => providersStore.getSlashCommandsForProvider(providerId),
  mergeSlashCommands,
  getUsageAgentKey: () => {
    const target = currentTargetAgent();
    return target?.id || target?.providerId || currentTargetAgentId || "default";
  },
  isComposingNewSession,
  currentComposerTargetLabel,
  getSendAsNewSession: () => sendAsNewSession,
  startSessionFromPrompt: (forceNewSession) => startSessionFromPrompt(forceNewSession),
  toggleNewSession: () => {
    if (currentSession()) {
      saveCurrentSession(null);
      sendAsNewSession = true;
      renderWorkspace();
      renderHistory();
    } else {
      sendAsNewSession = !sendAsNewSession;
    }
    updateActionLabels();
    focusComposerInput();
  },
  exitFullscreenSessions,
  setAppNotice,
  t,
  escapeHtml,
});

// Session Launch Controller 接管发送校验、Session 创建与附件 prompt 装配。
sessionLaunchController = createSessionLaunchController({
  getPromptValue: () => promptBox.value,
  focusPrompt: () => promptBox.focus(),
  clearPrompt: () => { promptBox.value = ""; },
  getComposerAttachments: () => composerController.getAttachments(),
  clearComposerAttachments: () => composerController.clearAttachments(),
  getCurrentTargetAgent: currentTargetAgent,
  getCurrentTargetProvider: currentTargetProvider,
  providerById,
  targetDisplayName,
  canTargetStartSession,
  targetSendBlockNotice,
  canSendToProvider,
  providerAvailability,
  providerAvailabilityLabel,
  getCurrentSession: currentSession,
  isComposingNewSession,
  currentSessionSendBlockReason,
  normalizeWorkspaceSession,
  upsertSession: (session) => sessionsStore.upsertHead(session),
  markSessionActive,
  isSessionActive: (sessionId) => sessionsStore.isSessionActive(sessionId),
  saveCurrentSession,
  unmarkStopped: (sessionId) => sessionsStore.unmarkStopped(sessionId),
  createSessionTurn,
  sessionPromptQueue: sessionPromptQueueController,
  renderWorkspace,
  renderHistory,
  setSendAsNewSession: (value) => { sendAsNewSession = value; },
  updateActionLabels,
  isTargetActivatable,
  acpCommandsForProvider,
  startAcpSession,
  runFallbackSession,
  setAppNotice,
  t,
});

// DOM 事件仅调用 Launch Controller，不再持有发送流程 Implementation。
function startSessionFromPrompt(forceNewSession = false) {
  return sessionLaunchController?.startSessionFromPrompt(forceNewSession);
}

providerManagerBtn?.addEventListener("click", () => {
  openAvailabilityModal();
});

composerController.bindEvents();

fontScaleBtn?.addEventListener("click", () => {
  cycleFontScale();
});

themeBtn?.addEventListener("click", () => {
  cycleTheme();
});

languageBtn?.addEventListener("click", () => {
  toggleLanguage();
});

if (listenRuntimeEvent) {
  listenRuntimeEvent("runtime-session-update", (payload) => {
    const runtimeSessionId = payload?.payload?.runtimeSessionId;
    const turnId = payload?.payload?.turnId;
    const promptRunId = payload?.payload?.promptRunId;
    const event = payload?.payload?.event;
    if (!runtimeSessionId || !turnId || !promptRunId || !event) return;
    sessionExecutionController?.appendStreamEvent(runtimeSessionId, turnId, promptRunId, event);
  }).catch((error) => {
    console.error(error);
  });
}

renderProviders();
applyStaticTranslations();
applyFontScale();
applyTheme();
void loadUserThemes();
updateSendModeLabel();
workspaceViewStore.hydrateFromSessions(sessionsSnapshot());
renderWorkspace();
renderHistory();
updateActionLabels();
setTimeout(() => {
  loadRuntimeConfigState()
    .then(() => {
      renderProviders();
    })
    .catch((error) => {
      console.error(error);
    });
}, 0);
setTimeout(() => {
  void loadHistory();
}, 0);
setTimeout(() => {
  refreshRuntimeProbe().then(() => {
    const providerIds = [...new Set(runtimeInstancesSnapshot()
      .filter((instance) => instance.available)
      .map((instance) => instance.providerId))];
    providerIds.forEach((providerId) => {
      void loadRuntimeTargetsForProvider(providerId);
    });
  });
}, 0);

async function syncRuntimeAliveStates() {
  const sessions = sessionsSnapshot();
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
      if (acpRuntimeClient.canHandle(providerId)) {
        aliveByProvider[providerId] = new Set(
          await acpRuntimeClient.aliveIds(providerId),
        );
      }
    }
    let mutated = false;
    sessions.forEach((session) => {
      const declaredLive = sessionRuntimeState(session) === "live";
      const hasStartedRuntime = Boolean(session.acpSessionId);
      const aliveIds = aliveByProvider[session.providerId];
      if (declaredLive && hasStartedRuntime && aliveIds && !aliveIds.has(session.id)) {
        setSessionLifecycle(session, LIFECYCLE.resume_failed);
        setRuntimeBinding(session, {
          state: RUNTIME_BINDING_STATE.failed,
          stage: RUNTIME_BINDING_STAGE.runtime,
          error_title: t("runtime.aliveExitedTitle", { agent: session.agentName || session.providerName }),
          error_detail: t("runtime.aliveExited"),
          error_suggestion: t("runtime.aliveExitedSuggestion"),
        });
        sessionsStore.markInactive(session.id);
        mutated = true;
      }
    });
    if (mutated) {
      renderWorkspace();
      renderHistory();
      setAppNotice(t("runtime.aliveExited"), "error");
    }
  } catch (error) {
    console.error(error);
  }
}

setInterval(() => { void syncRuntimeAliveStates(); }, 15000);
