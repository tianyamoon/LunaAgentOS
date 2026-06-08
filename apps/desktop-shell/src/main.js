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
import {
  compactNoticeText as compactNoticeTextValue,
  createAppNoticeController,
} from "./ui/appNoticeController.js";
import {
  formatBackendError as formatBackendErrorValue,
  formatTime as formatTimeValue,
} from "./ui/appFormatters.js";
import { createAppChromeController } from "./ui/appChromeController.js";
import { createConfirmDialogController } from "./ui/confirmDialogController.js";
import { createRenderScheduler } from "./ui/renderScheduler.js";
import { createRuntimeSessionCardView } from "./ui/runtimeSessionCardView.js";
import { createRuntimeSessionCardController } from "./ui/runtimeSessionCardController.js";
import { projectRuntimeSessionMessageList } from "./ui/runtimeSessionMessageListProjection.js";
import { createRuntimeSessionMessageListView } from "./ui/runtimeSessionMessageListView.js";
import {
  providerAvailabilityLabel,
  providerAvailabilityState,
  stateClasses,
  stateDisplayLabel,
  stateName,
} from "./ui/runtimeStatePresentation.js";
import {
  sessionCardStats,
  turnResponseText,
} from "./ui/sessionCardView.js";
import {
  sessionTranscriptText as sessionTranscriptTextValue,
} from "./ui/sessionTranscript.js";
import { createHistoryView } from "./ui/historyView.js";
import { createWorkspaceView } from "./ui/workspaceView.js";
import { createWorkspaceEmptyView } from "./ui/workspaceEmptyView.js";
import { createWorkspaceStatusView } from "./ui/workspaceStatusView.js";
import { createShellSurface } from "./ui/shellSurface.js";
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
  isActiveSessionListItem,
  isArchivedSessionListItem,
  projectSessionListItems,
} from "./state/sessionListItems.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
  createRuntimeBinding,
  isRunningTurnStatus,
  resolveSessionCardControlState,
  resolveSessionCardStatusView,
  resolveSessionListPresentationState,
} from "./state/sessionStatus.js";
import {
  canTargetStartSession,
  isStoppedHermesTarget,
  isTargetActivatable,
  isTargetSelectable,
  isTargetSendable,
} from "./state/targetActivation.js";
import { getAvailabilityStore } from "./state/availabilityStore.js";
import { createAppPreferences } from "./state/appPreferences.js";
import {
  acpCommandsForProvider as acpCommandsForProviderRaw,
} from "./runtime/acpCommands.js";
import { createAcpRuntimeClient } from "./runtime/acpRuntimeClient.js";
import {
  createRuntimeAdapterCatalog,
  mergeSlashCommands,
} from "./runtime/runtimeAdapterCatalog.js";
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
import { createUserThemeCatalog } from "./themes/userThemeCatalog.js";
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
import { createRuntimeConfigState } from "./state/runtimeConfigState.js";
import {
  ensureRestoredAgentEntry,
  projectWorkspaceSessionFromArchived,
} from "./state/sessionRestoreProjection.js";
import { createWorkspaceSessionController } from "./controllers/workspaceSessionController.js";
import { createSessionRestoreController } from "./controllers/sessionRestoreController.js";
import { createSessionLifecycleController } from "./controllers/sessionLifecycleController.js";
import { createSessionExecutionController } from "./controllers/sessionExecutionController.js";
import { createSessionLaunchController } from "./controllers/sessionLaunchController.js";
import { createSessionPromptQueueController } from "./controllers/sessionPromptQueueController.js";
import { createCurrentTargetController } from "./controllers/currentTargetController.js";
import { createRuntimeProbeController } from "./controllers/runtimeProbeController.js";
import { createAgentBriefController } from "./controllers/agentBriefController.js";
import {
  availableRuntimeInstancesForProvider as availableRuntimeInstancesForProviderRaw,
  providerRuntimeLabel as providerRuntimeLabelRaw,
  runtimeInstanceById as runtimeInstanceByIdRaw,
  runtimeInstancesForProvider as runtimeInstancesForProviderRaw,
  targetsForRuntimeInstance as targetsForRuntimeInstanceRaw,
} from "./providers/runtimeView.js";
import {
  canSendToProviderRuntime,
  chooseCurrentTargetAgentId,
  compactTargetSubtitle as compactTargetSubtitleValue,
  findAgentEntry,
  findProviderForAgent,
  projectAllAgentEntries,
  projectProviderAvailability,
  projectProviderState,
  projectRuntimeTargets,
  projectTargetsForProvider,
  providerMetaLabel as providerMetaLabelValue,
  providerRuntimeMiniLabel as providerRuntimeMiniLabelValue,
} from "./providers/providerRuntimeProjection.js";
import { providerSupportsLaunch } from "./providers/providerCatalog.js";
import {
  fallbackBriefKeyForTarget,
  providerStatusForFleet,
  targetStatusForFleet,
} from "./providers/agentMetadata.js";
import {
  buildAgentBriefPrompt,
  parseAgentBriefResponse,
} from "./providers/agentBrief.js";
import { sessionSectionsFromEvents } from "./runtime/streamEvents.js";
import { FALLBACK_SESSIONS } from "./fixtures/fallbackSessions.js";

const { invoke } = window.__TAURI__.core;
const listenRuntimeEvent = window.__TAURI__?.event?.listen?.bind(window.__TAURI__.event);

const HISTORY_SCHEMA_VERSION = 5;
const STREAM_CARD_RENDER_INTERVAL_MS = 100;
const FONT_SCALE_OPTIONS = [
  { id: "compact", labelKey: "font.compact", scale: 0.92 },
  { id: "default", labelKey: "font.default", scale: 1 },
  { id: "comfortable", labelKey: "font.comfortable", scale: 1.08 },
];

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

const appPreferences = createAppPreferences({
  defaultThemeId: DEFAULT_THEME_ID,
});

appPreferences.clearCurrentSessionId();

let currentTargetAgentId = appPreferences.getCurrentTargetId();
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
const runtimeAdapterCatalog = createRuntimeAdapterCatalog({ invoke });
const userThemeCatalog = createUserThemeCatalog({ invoke, registerUserThemes });
const appChromeController = createAppChromeController({
  documentRef: document,
  providerManagerBtn,
  languageBtn,
  fontScaleBtn,
  themeBtn,
  appPreferences,
  userThemeCatalog,
  applyDataI18n,
  getLanguage,
  t,
  toggleLanguagePreference: toggleLanguagePref,
  fontScaleOptions: FONT_SCALE_OPTIONS,
  findTheme,
  nextThemeId,
  defaultThemeId: DEFAULT_THEME_ID,
  themes: THEMES,
  themeLabel,
  afterStaticTranslations: () => {
    updateActionLabels();
    updateSendModeLabel();
    updatePromptPlaceholder();
  },
  afterLanguageChanged: () => {
    renderProviders();
    renderWorkspace();
    renderHistory();
  },
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
    getStateName: stateName,
  }),
  projectArchivedSessions: (entries) => archivedSessionsFromHistoryRaw(entries, {
    normalizeSession: normalizeWorkspaceSession,
  }),
});
const runtimeConfigState = createRuntimeConfigState({ invoke });
const workspaceViewStore = createWorkspaceViewStore();
let workspaceSessionController = null;
let sessionRestoreController = null;
let sessionLifecycleController = null;
let sessionExecutionController = null;
let sessionLaunchController = null;
let sessionPromptQueueController = null;
let currentTargetController = null;
let agentBriefController = null;
let composerController = null;
let agentFleetView = null;
let agentManagementView = null;
let runtimeSessionCardView = null;
let runtimeSessionCardController = null;
let historyView = null;
let workspaceView = null;
let workspaceEmptyView = null;
let workspaceStatusView = null;
let runtimeProbeController = null;
let shellSurface = null;
let sendAsNewSession = false;
const sessionListSectionOpenState = {
  active: true,
  archive: true,
};
const collapsedProviderIds = new Set(appPreferences.getCollapsedProviderIds());
const confirmDialogController = createConfirmDialogController({
  element: confirmDialog,
  translate: t,
});
const appNoticeController = createAppNoticeController({ element: appNotice });
const workspaceRenderScheduler = createRenderScheduler({
  render: (options) => renderWorkspace(options),
});

function allAgents() {
  return projectAllAgentEntries({
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargets: runtimeTargets(),
  });
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
  return projectRuntimeTargets({
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
  return projectTargetsForProvider(providerId, {
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargetsByInstance: providersStore.getRuntimeTargetsByInstanceSnapshot(),
  });
}

function compactTargetSubtitle(target) {
  return compactTargetSubtitleValue(target, { translate: t });
}

function providerMetaLabel(provider, targets, instances) {
  return providerMetaLabelValue(provider, targets, instances, { translate: t });
}

function providerRuntimeMiniLabel(instances) {
  return providerRuntimeMiniLabelValue(instances);
}

function ensureCurrentTargetAgentExists() {
  const nextTargetAgentId = chooseCurrentTargetAgentId(currentTargetAgentId, {
    agents: allAgents(),
    isSelectable: isTargetSelectable,
    isSendable: isTargetSendable,
    isActivatable: isTargetActivatable,
  });
  if (nextTargetAgentId !== currentTargetAgentId) saveCurrentTargetAgent(nextTargetAgentId);
}

function agentById(id) {
  return findAgentEntry(id, {
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargets: runtimeTargets(),
  });
}

function providerForAgent(agentId) {
  return findProviderForAgent(agentId, {
    providers: providersSnapshot(),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargets: runtimeTargets(),
  });
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

async function loadRuntimeConfigState() {
  return runtimeConfigState.load();
}

async function ensureRuntimeConfigState() {
  return runtimeConfigState.ensure();
}

async function saveAgentBriefRecords(nextBriefs) {
  return runtimeConfigState.saveAgentBriefRecords(nextBriefs);
}

function cloneAgentBriefs() {
  return runtimeConfigState.getAgentBriefsSnapshot();
}

function targetBriefRecord(target, language = getLanguage()) {
  return runtimeConfigState.targetBriefRecord(target, language);
}

function targetBriefText(target) {
  return runtimeConfigState.targetBriefText(target, {
    language: getLanguage(),
    translate: t,
  });
}

function targetBriefInputValue(target, language) {
  return runtimeConfigState.targetBriefInputValue(target, language);
}

function writeBriefValue(nextBriefs, target, language, value, source = "manual") {
  runtimeConfigState.writeBriefValue(nextBriefs, target, language, value, source);
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
  return projectProviderState(provider, {
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeAvailability: providersStore.getRuntimeAvailabilityFor(provider.id),
    availabilityState: providerAvailabilityState,
  });
}

function providerAvailability(providerId) {
  return projectProviderAvailability(providerId, {
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeAvailability: providersStore.getRuntimeAvailabilityFor(providerId),
  });
}

function canSendToProvider(providerId) {
  return canSendToProviderRuntime(providerId, {
    provider: providerById(providerId),
    runtimeInstances: runtimeInstancesSnapshot(),
    runtimeTargets: runtimeTargets(),
    availability: providerAvailability(providerId),
    canStartSession: canTargetStartSession,
  });
}

function formatTime(value) {
  return formatTimeValue(value, "zh-CN");
}

function isSessionExecuting(session) {
  return isRunningTurnStatus(session?.turns?.find((turn) => turn.id === session?.activeTurnId)?.status || session?.turns?.at(-1)?.status);
}

function formatBackendError(error) {
  return formatBackendErrorValue(error, t);
}

function compactNoticeText(value, maxLength = 180) {
  return compactNoticeTextValue(value, maxLength);
}

function setAppNotice(message, tone = "muted") {
  appNoticeController.set(message, tone);
}

function applyStaticTranslations() {
  appChromeController.applyStaticTranslations();
}

function toggleLanguage() {
  appChromeController.toggleLanguage();
}

function closeConfirmDialog() {
  confirmDialogController.close();
}

function openConfirmDialog(options) {
  confirmDialogController.open(options);
}

function updateActionLabels() {
  composerController?.updateActionLabels();
}

function updatePromptPlaceholder() {
  composerController?.updatePromptPlaceholder();
}

function scheduleWorkspaceRender(options = {}, delayMs = 0) {
  workspaceRenderScheduler.schedule(options, delayMs);
}

function saveCurrentTargetAgent(agentId) {
  currentTargetAgentId = agentId;
  appPreferences.setCurrentTargetId(agentId);
}

function saveCurrentSession(sessionId) {
  sessionsStore.setCurrentSessionId(sessionId || null);
  appPreferences.clearCurrentSessionId();
}

function toggleProviderCollapsed(providerId) {
  if (!providerId) return;
  if (collapsedProviderIds.has(providerId)) {
    collapsedProviderIds.delete(providerId);
  } else {
    collapsedProviderIds.add(providerId);
  }
  appPreferences.setCollapsedProviderIds([...collapsedProviderIds]);
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
  appPreferences.clearCurrentSessionId();
}

function currentSession() {
  return sessionsStore.getSession(sessionsStore.getCurrentSessionId());
}

function isComposingNewSession() {
  const session = currentSession();
  return sendAsNewSession || !session || !sessionsStore.isSessionActive(session.id);
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
  return appChromeController.currentFontScaleOption();
}

function applyFontScale() {
  appChromeController.applyFontScale();
}

function cycleFontScale() {
  appChromeController.cycleFontScale();
}

function currentTheme() {
  return appChromeController.currentTheme();
}

function applyTheme() {
  appChromeController.applyTheme();
}

function cycleTheme() {
  appChromeController.cycleTheme();
}

async function loadUserThemes() {
  return appChromeController.loadUserThemes();
}

function updateSendModeLabel() {
  composerController?.updateSendModeLabel();
}

async function fetchAgentBriefForTarget(target) {
  return agentBriefController?.fetchAgentBriefForTarget(target);
}

async function refreshAgentBriefForTarget(target, { quiet = false } = {}) {
  return agentBriefController?.refreshAgentBriefForTarget(target, { quiet }) || null;
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
  return runtimeProbeController?.refreshRuntimeProbe() || null;
}

// 连接弹窗重查时统一刷新探测结果和该 Provider 的目标列表。
async function refreshProviderConnections(providerId) {
  return runtimeProbeController?.refreshProviderConnections(providerId);
}

function latestActiveSessionForAgent(agentId) {
  return sessionsSnapshot()
    .filter((session) => session.agentId === agentId && sessionsStore.isSessionActive(session.id) && canSendToSession(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

function setCurrentTargetAgent(agentId) {
  return currentTargetController?.setCurrentTargetAgent(agentId) || false;
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

async function loadRuntimeSlashCommandsForProvider(providerId, runtimeInstanceIds = null) {
  return runtimeProbeController?.loadRuntimeSlashCommandsForProvider(providerId, runtimeInstanceIds);
}

async function loadRuntimeTargetsForProvider(providerId, runtimeInstanceIds = null) {
  return runtimeProbeController?.loadRuntimeTargetsForProvider(providerId, runtimeInstanceIds);
}

// Agent Brief 与 Composer 共用同一条 Session 创建路径。
function createSessionForAgent(agent, firstTask) {
  return sessionLaunchController?.createSessionForAgent(agent, firstTask) || null;
}

// Agent Brief 与 Composer 共用同一条 Turn 创建路径。
function createTurn(session, task, options = {}) {
  return sessionLaunchController?.createTurn(session, task, options) || null;
}

function renderWorkspaceEmptyCopy() {
  workspaceEmptyView?.renderWorkspaceEmptyCopy();
}

function renderWorkspaceStatus() {
  workspaceStatusView?.renderWorkspaceStatus();
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
  return sessionTranscriptTextValue(session, {
    translate: t,
    turnResponseText,
  });
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
  resolveSessionCardControlState,
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
  providerAvailabilityState,
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

shellSurface = createShellSurface({
  renderProviders,
  renderWorkspace,
  renderHistory,
  renderWorkspaceStatus,
  renderWorkspaceEmptyCopy,
  updateActionLabels,
  focusComposerInput,
});

workspaceSessionController = createWorkspaceSessionController({
  getSession: (sessionId) => sessionsStore.getSession(sessionId),
  workspaceViewStore,
  saveCurrentTargetAgent,
  saveCurrentSession,
  setSendAsNewSession: (value) => { sendAsNewSession = value; },
  canSendToSession,
  markSessionActive,
  shellSurface,
  sessionRuntimeState,
  setAppNotice,
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
  resolveSessionListPresentationState,
  canSendToSession,
  canRestoreSession,
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

currentTargetController = createCurrentTargetController({
  agentById,
  isTargetSelectable,
  targetSendBlockNotice,
  saveCurrentTargetAgent,
  getCurrentTargetAgent: currentTargetAgent,
  getCurrentTargetProvider: currentTargetProvider,
  getCurrentSession: currentSession,
  saveCurrentSession,
  setSendAsNewSession: (value) => { sendAsNewSession = value; },
  shellSurface,
  setAppNotice,
  targetDisplayName,
  t,
});
// Repository 快照变化时刷新右侧列表，包含加载态切换与后台写入结果。
historyRepository.subscribe(() => renderHistory());

workspaceStatusView = createWorkspaceStatusView({
  element: workspaceStatus,
  getCurrentTargetAgent: currentTargetAgent,
  getCurrentTargetProvider: currentTargetProvider,
  getSessionsSnapshot: sessionsSnapshot,
  getCurrentSession: currentSession,
  getLatestActiveSessionForAgent: latestActiveSessionForAgent,
  getProviderAvailability: providerAvailability,
  sessionRecordState,
  targetDisplayName,
  providerAvailabilityLabel,
  stateClasses,
  stateDisplayLabel,
  resolveSessionCardStatusView,
  t,
  escapeHtml,
});

workspaceEmptyView = createWorkspaceEmptyView({
  element: workspaceEmpty,
  getSessionsSnapshot: sessionsSnapshot,
  getArchivedSessions: archivedSessionsFromHistory,
  t,
});

workspaceView = createWorkspaceView({
  sessionDeck,
  workspaceEmpty,
  getSessionsSnapshot: sessionsSnapshot,
  workspaceViewStore,
  updatePromptPlaceholder,
  renderWorkspaceStatus,
  renderWorkspaceEmptyCopy,
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
    workspaceRenderScheduler.updatePendingOptions((options) => (
      options.focusSessionId === sessionId ? { ...options, focusSessionId: null } : options
    ));
  },
  clearQueuedSubmissions: (session, reason) => sessionPromptQueueController?.clear(session, reason),
  shellSurface,
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
  return projectSessionListItems({
    sessions: sessionsSnapshot(),
    archivedSessions: archivedSessionsFromHistory(),
    normalizeSession: normalizeWorkspaceSession,
    ensureSessionStatusShape,
    sessionRuntimeState,
    createRuntimeBinding,
    translate: t,
    constants: { RECORD_STATE, ACCESS_MODE },
  });
}

function renderHistory(options = {}) {
  historyView?.renderHistory(options);
}

function workspaceSessionFromArchived(archived, existing = null) {
  return projectWorkspaceSessionFromArchived(archived, {
    existing,
    agentEntries: [...runtimeTargets(), ...providersSnapshot().flatMap((provider) => provider.agents || [])],
    ensureAgentEntry: (agentEntry) => ensureRestoredAgentEntry(agentEntry, {
      providers: providersSnapshot(),
      providerById,
      agentById,
      appendProviderAgent: (providerId, agent) => providersStore.appendProviderAgent(providerId, agent),
      translate: t,
    }),
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
  shellSurface,
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
  shellSurface,
  scheduleSessionCardRender,
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
  persistTurnSnapshot: (session, turn) => saveTurnToHistory(session, turn),
  dispatchPromptRun: (session, turn) => {
    if (acpCommandsForProvider(session.providerId)) {
      void startAcpSession(session, turn);
    } else {
      void runFallbackSession(session, turn);
    }
  },
  shellSurface,
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
      shellSurface.refresh({ workspace: true, history: true });
    } else {
      sendAsNewSession = !sendAsNewSession;
    }
    shellSurface.refresh({ actions: true, focusComposer: true });
  },
  exitFullscreenSessions,
  setAppNotice,
  t,
  escapeHtml,
});

// Runtime Probe Controller 接管 Adapter 探测、动态 targets 与 slash commands 刷新。
runtimeProbeController = createRuntimeProbeController({
  runtimeAdapterCatalog,
  providersStore,
  setAdapterIconRegistry,
  getProvidersSnapshot: providersSnapshot,
  getRuntimeInstancesSnapshot: runtimeInstancesSnapshot,
  getCurrentTargetAgent: currentTargetAgent,
  getAvailabilityStore,
  providerById,
  availableRuntimeInstancesForProvider,
  runtimeInstanceById,
  ensureCurrentTargetAgentExists,
  shellSurface,
  refreshComposerCommands: () => composerController?.refreshCommands(),
  setAppNotice,
  formatBackendError,
  t,
});

// Session Launch Controller 接管发送校验、Session 创建与附件 prompt 装配。
sessionLaunchController = createSessionLaunchController({
  getPromptValue: () => promptBox.value,
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
  shellSurface,
  setSendAsNewSession: (value) => { sendAsNewSession = value; },
  isTargetActivatable,
  acpCommandsForProvider,
  startAcpSession,
  runFallbackSession,
  setAppNotice,
  t,
});

// Agent Brief Controller 用一次隐藏 Session 自动生成职责简报，Shell 只提供运行入口。
agentBriefController = createAgentBriefController({
  isTargetSendable,
  acpCommandsForProvider,
  buildAgentBriefPrompt,
  createSessionForAgent,
  saveCurrentTargetAgent,
  saveCurrentSession,
  unmarkStopped: (sessionId) => sessionsStore.unmarkStopped(sessionId),
  createTurn,
  closeConfirmDialog,
  shellSurface,
  startAcpSession,
  parseAgentBriefResponse,
  cloneAgentBriefs,
  writeBriefValue,
  saveAgentBriefRecords,
  targetDisplayName,
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
