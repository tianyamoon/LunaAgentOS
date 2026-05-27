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
  normalizedSessionTitleParts,
  runtimeDefaultsForProvider as identityRuntimeDefaultsForProvider,
  runtimeHostForInstance as identityRuntimeHostForInstance,
} from "./sessionIdentity.js";
import {
  createStickToBottomController,
  createStickToBottomRegistry,
  isAtBottom,
} from "./ui/stickToBottom.js";
import {
  filterComposerSlashCommands,
  matchComposerSlashQuery,
  normalizeSlashCommand,
  slashCommandsForProvider,
} from "./ui/slashCommands.js";
import {
  sessionCardStats,
  sessionTurnVisibility,
  turnResponseText,
} from "./ui/sessionCardView.js";
import { turnEventsFromTurn } from "./ui/turnEvents.js";
import { renderTurnEventItemHtml, renderTurnEventsHtml } from "./ui/turnEventsView.js";
import { renderProviderIcon } from "./ui/providerIcon.js";
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
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
} from "./state/sessionListItems.js";
import { getAvailabilityStore } from "./state/availabilityStore.js";
import { AvailabilityView } from "./components/availability/AvailabilityView.js";
import {
  acpCommandsForProvider as acpCommandsForProviderRaw,
} from "./runtime/acpCommands.js";
import {
  applyDataI18n,
  getLanguage,
  t,
  toggleLanguage as toggleLanguagePref,
} from "./i18n/index.js";
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
  sortTargetsForAgentList,
  targetsForRuntimeInstance as targetsForRuntimeInstanceRaw,
} from "./providers/runtimeView.js";
import {
  agentBriefTargetKey,
  briefRecordForTarget,
  explicitBriefText,
  fallbackBriefKeyForTarget,
  providerStatusForFleet,
  targetStatusForFleet,
} from "./providers/agentMetadata.js";
import {
  applyEventsToTurn,
  applyStreamEventToTurn,
  sessionSectionsFromEvents,
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

const fallbackSessions = {
  hermes: {
    events: [
      { type: "state", state: 0, contentKey: "fallback.hermes.stateStart" },
      { type: "thought", state: 2, contentKey: "fallback.hermes.thought" },
      { type: "response", state: 4, contentKey: "fallback.hermes.response" },
      { type: "state", state: 5, contentKey: "fallback.hermes.stateDone" },
    ],
  },
  trae: {
    events: [
      { type: "state", state: 0, contentKey: "fallback.trae.stateStart" },
      { type: "thought", state: 2, contentKey: "fallback.trae.thought" },
      { type: "response", state: 4, contentKey: "fallback.trae.response" },
      { type: "state", state: 5, contentKey: "fallback.trae.stateDone" },
    ],
  },
};

const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const SEND_MODE_KEY = "lunaagentos.sendMode";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const PROVIDER_COLLAPSE_KEY = "lunaagentos.providerCollapsedIds";
const SLASH_COMMAND_USAGE_KEY = "lunaagentos.slashCommandUsage";
const HISTORY_SCHEMA_VERSION = 3;
const STREAM_CARD_RENDER_INTERVAL_MS = 100;
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

function readCollapsedProviderIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROVIDER_COLLAPSE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function readSlashCommandUsage() {
  try {
    const stored = JSON.parse(localStorage.getItem(SLASH_COMMAND_USAGE_KEY) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch (_) {
    return {};
  }
}

function slashCommandUsageAgentKey() {
  const target = currentTargetAgent();
  return target?.id || target?.providerId || currentTargetAgentId || "default";
}

function slashCommandUsageForCurrentAgent() {
  const usage = slashCommandUsage[slashCommandUsageAgentKey()];
  return usage && typeof usage === "object" && !Array.isArray(usage) ? usage : {};
}

function recordSlashCommandUsage(commandName) {
  const agentKey = slashCommandUsageAgentKey();
  const current = slashCommandUsageForCurrentAgent();
  slashCommandUsage = {
    ...slashCommandUsage,
    [agentKey]: {
      ...current,
      [commandName]: Number(current[commandName] || 0) + 1,
    },
  };
  localStorage.setItem(SLASH_COMMAND_USAGE_KEY, JSON.stringify(slashCommandUsage));
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
const newSessionToggle = document.getElementById("newSessionToggle");
const sendBtn = document.getElementById("sendBtn");
const sendModeBtn = document.getElementById("sendModeBtn");
const fontScaleBtn = document.getElementById("fontScaleBtn");
const languageBtn = document.getElementById("languageBtn");
const confirmDialog = document.getElementById("confirmDialog");

localStorage.removeItem(CURRENT_SESSION_KEY);

let currentTargetAgentId = localStorage.getItem(CURRENT_TARGET_AGENT_KEY) || localStorage.getItem(LEGACY_TARGET_AGENT_KEY) || "claude-main";
const providersStore = createProvidersStore();
const providers = providersStore.getProvidersRef();
const runtimeAvailability = providersStore.getRuntimeAvailabilityRef();
const runtimeInstances = providersStore.getRuntimeInstancesRef();
const runtimeTargetsByInstance = providersStore.getRuntimeTargetsByInstanceRef();
const slashCommandsByProvider = providersStore.getSlashCommandsByProviderRef();
const sessionsStore = createSessionsStore();
const sessions = sessionsStore.getSessionsRef();
const activeSessionIds = sessionsStore.getActiveSessionIdsRef();
let historyEntries = [];
let sessionSeq = 0;
let turnSeq = 0;
let runningSessions = 0;
let isHistoryLoading = true;
let sendAsNewSession = false;
let sendMode = localStorage.getItem(SEND_MODE_KEY) || "enter";
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";
let runtimeConfigSnapshot = null;
let agentBriefs = {};
const deletedSessionIds = sessionsStore.getDeletedSessionIdsRef();
const stoppedSessionIds = sessionsStore.getStoppedSessionIdsRef();
const flowDetailOpenState = sessionsStore.getFlowDetailOpenStateRef();
const collapsedTurnIds = sessionsStore.getCollapsedTurnIdsRef();
const sessionLatestOnlyState = sessionsStore.getSessionLatestOnlyStateRef();
const sessionListSectionOpenState = {
  active: true,
  archive: true,
};
const collapsedProviderIds = new Set(readCollapsedProviderIds());
let scheduledWorkspaceRenderOptions = null;
let scheduledWorkspaceRenderFrame = 0;
let scheduledWorkspaceRenderTimer = 0;
let pendingConfirmAction = null;
let restoreIntentSeq = 0;
let composerCommandHint = null;
let composerCommandMenu = null;
let composerCommandMenuOpen = false;
let composerCommandMenuPinned = false;
let composerCommandMenuActiveIndex = 0;
let composerCommandSearchQuery = "";
let composerCommandSearchFocused = false;
let slashCommandUsage = readSlashCommandUsage();

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

function isStoppedHermesTarget(target) {
  if (!target || target.providerId !== "hermes") return false;
  if (target.gateway) return target.gateway !== "running";
  return target.state === 9;
}

function isTargetSendable(target) {
  if (!target) return false;
  if (isStoppedHermesTarget(target)) return false;
  return target.available !== false;
}

function targetSendBlockNotice(target) {
  const targetName = targetDisplayName(target) || displayAgentName(target) || "Hermes";
  if (isStoppedHermesTarget(target)) {
    return t("composer.blockStoppedTarget", { target: targetName });
  }
  return t("composer.blockUnavailableTarget", { target: targetName });
}

function sessionIdentityTitle(session) {
  return normalizedSessionTitle(session, providers);
}

function renderSessionIdentityTitle(session) {
  const parts = normalizedSessionTitleParts(session, providers);
  const provider = providerById(session.providerId);
  const icon = renderProviderIcon(provider || { id: session.providerId, name: parts.providerName });
  if (session.providerId === "hermes") {
    return [
      `<span class="session-title-provider">${icon}${escapeHtml(parts.providerName)}</span>`,
      parts.runtimeLabel ? `<span class="session-title-runtime">${escapeHtml(parts.runtimeLabel)}</span>` : "",
      parts.targetName ? `<span class="session-title-target">${escapeHtml(parts.targetName)}</span>` : "",
    ].filter(Boolean).join("");
  }
  if (session.providerId === "claude") {
    return [
      `<span class="session-title-provider">${icon}${escapeHtml(parts.providerName)}</span>`,
      parts.runtimeLabel ? `<span class="session-title-runtime">${escapeHtml(parts.runtimeLabel)}</span>` : "",
    ].filter(Boolean).join("");
  }
  return `<span class="session-title-provider">${icon}${escapeHtml(parts.providerName)}</span>`;
}

function targetsForRuntimeInstance(instance) {
  return targetsForRuntimeInstanceRaw(instance, {
    providers,
    runtimeInstances,
    runtimeTargetsByInstance,
  });
}

function runtimeTargets() {
  return runtimeTargetsRaw({ providers, runtimeInstances, runtimeTargetsByInstance });
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
  return sortTargetsForAgentList(instances.flatMap(targetsForRuntimeInstance));
}

function compactTargetSubtitle(target) {
  if (!target) return "";
  const parts = [];
  if (target.providerId === "hermes") {
    if (target.gateway === "running") parts.push(t("availability.gatewayRunning"));
    else if (target.gateway) parts.push(t("availability.gatewayStopped"));
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
  const currentTarget = agentById(currentTargetAgentId);
  if (currentTarget && isTargetSendable(currentTarget)) return;
  const defaultHermesTarget = agentById(DEFAULT_HERMES_AGENT_ID);
  if (defaultHermesTarget && isTargetSendable(defaultHermesTarget)) {
    saveCurrentTargetAgent(DEFAULT_HERMES_AGENT_ID);
    return;
  }
  const claudeWinTarget = agentById("claude-win");
  if (claudeWinTarget && isTargetSendable(claudeWinTarget)) {
    saveCurrentTargetAgent("claude-win");
    return;
  }
  const fallbackAgent = allAgents().find(isTargetSendable);
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

function acpInvokeArgs(commands, providerId, args = {}) {
  return commands?.requiresAdapterId ? { adapterId: providerId, ...args } : args;
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
    return runtimeTargets().some((target) => target.providerId === providerId && isTargetSendable(target));
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
  return Boolean(session?.acpSessionId) && canRestoreLifecycle(sessionLifecycle(session));
}

function isArchivedSessionListItem(item) {
  if (!item?.isInWorkspace && !item?.acpSessionId) return true;
  return isArchivedLifecycle(item.runtimeState || LIFECYCLE.live);
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
  updateActionLabels();
  updateSendModeLabel();
  updatePromptPlaceholder();
  updateComposerCommandHint();
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
  const composingNewSession = isComposingNewSession();
  sendBtn.textContent = t("composer.send");
  newSessionToggle.classList.toggle("is-active", composingNewSession);
  newSessionToggle.setAttribute("aria-pressed", String(composingNewSession));
  composer?.classList.toggle("is-new-session-mode", composingNewSession);
  composer?.classList.toggle("is-current-session-mode", !composingNewSession);
  updateComposerCommandHint();
  updatePromptPlaceholder();
}

function updatePromptPlaceholder() {
  const target = currentComposerTargetLabel();
  promptBox.placeholder = target
    ? t(isComposingNewSession() ? "composer.placeholderNewSession" : "composer.placeholderCurrentSession", { target })
    : t("composer.placeholderNoTarget");
}

function ensureComposerCommandHint() {
  if (!composer || composerCommandHint) return;
  const row = composer.querySelector(".composer-row");
  composerCommandHint = document.createElement("div");
  composerCommandHint.className = "composer-command-hint";
  composerCommandHint.setAttribute("aria-live", "polite");
  if (row) composer.insertBefore(composerCommandHint, row);
  else composer.prepend(composerCommandHint);
}

function ensureComposerCommandMenu() {
  if (!composer || composerCommandMenu) return;
  composerCommandMenu = document.createElement("div");
  composerCommandMenu.className = "composer-command-menu";
  composerCommandMenu.hidden = true;
  composer.appendChild(composerCommandMenu);
}

function composerInputKind() {
  return promptBox.value.trimStart().startsWith("/") ? "slash" : "plain";
}

function composerSlashQuery() {
  return matchComposerSlashQuery(promptBox.value);
}

function composerSlashCommands() {
  return slashCommandsForProvider(localizedComposerSlashCommands(), currentTargetProvider()?.id);
}

function filteredComposerSlashCommands() {
  const searchQuery = composerCommandSearchFocused || composerCommandSearchQuery
    ? composerCommandSearchQuery.trim().toLowerCase()
    : null;
  return filterComposerSlashCommands(localizedComposerSlashCommands(), {
    providerId: currentTargetProvider()?.id,
    query: searchQuery ?? composerSlashQuery(),
    pinned: searchQuery === null && composerCommandMenuPinned,
    usageByName: slashCommandUsageForCurrentAgent(),
  });
}

function localizedComposerSlashCommands() {
  const provider = currentTargetProvider();
  const providerId = provider?.id;
  const manifestCommands = provider?.adapterManifest?.capabilities?.slashCommands;
  const dynamicCommands = providerId ? slashCommandsByProvider[providerId] : [];
  return mergeSlashCommands([...(Array.isArray(manifestCommands) ? manifestCommands : []), ...(Array.isArray(dynamicCommands) ? dynamicCommands : [])])
    .map((command) => normalizeSlashCommand(command, {
      providerId,
      description: command.description || t(command.descriptionKey),
    }))
    .filter(Boolean);
}

function closeComposerCommandMenu() {
  composerCommandMenuOpen = false;
  composerCommandMenuPinned = false;
  composerCommandSearchFocused = false;
  composerCommandMenuActiveIndex = 0;
  if (composerCommandMenu) composerCommandMenu.hidden = true;
}

function openComposerCommandMenu({ pinned = false } = {}) {
  ensureComposerCommandMenu();
  composerCommandMenuOpen = true;
  composerCommandMenuPinned = pinned;
  composerCommandMenuActiveIndex = 0;
  renderComposerCommandMenu();
}

function selectComposerCommand(index) {
  const command = filteredComposerSlashCommands()[index];
  if (!command) return false;
  promptBox.value = `/${command.name} `;
  recordSlashCommandUsage(command.name);
  composerCommandSearchQuery = "";
  composerCommandSearchFocused = false;
  promptBox.focus();
  promptBox.setSelectionRange(promptBox.value.length, promptBox.value.length);
  closeComposerCommandMenu();
  updateComposerCommandHint();
  return true;
}

function syncComposerCommandMenuActiveItem({ scrollIntoView = false } = {}) {
  if (!composerCommandMenu) return;
  composerCommandMenu.querySelectorAll(".composer-command-menu-item").forEach((button) => {
    const isActive = Number(button.dataset.commandIndex || 0) === composerCommandMenuActiveIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive && scrollIntoView) button.scrollIntoView({ block: "nearest" });
  });
}

function renderComposerCommandMenu() {
  ensureComposerCommandMenu();
  if (!composerCommandMenu) return;
  const commands = filteredComposerSlashCommands();
  const usageByName = slashCommandUsageForCurrentAgent();
  if (!composerCommandMenuOpen) {
    composerCommandMenu.hidden = true;
    return;
  }
  if (composerCommandMenuActiveIndex >= commands.length) composerCommandMenuActiveIndex = 0;
  composerCommandMenu.hidden = false;
  composerCommandMenu.innerHTML = `
    <div class="composer-command-menu-panel" role="listbox" aria-label="${escapeHtml(t("composer.commandMenu.title"))}">
      <div class="composer-command-menu-header">
        <strong>${escapeHtml(t("composer.commandMenu.title"))}</strong>
        <span>${escapeHtml(t("composer.commandMenu.hint"))}</span>
      </div>
      <div class="composer-command-menu-list">
        ${commands.length ? commands.map((command, index) => `
          <button type="button" class="composer-command-menu-item ${index === composerCommandMenuActiveIndex ? "is-active" : ""}" role="option" aria-selected="${index === composerCommandMenuActiveIndex ? "true" : "false"}" data-command-index="${index}">
            <span class="composer-command-menu-name">/${escapeHtml(command.name)}</span>
            <span class="composer-command-menu-description">${escapeHtml(command.description || t(command.descriptionKey))}</span>
            ${usageByName[command.name] ? `<span class="composer-command-menu-badge">${escapeHtml(t("composer.commandMenu.frequent"))}</span>` : ""}
          </button>
        `).join("") : `<div class="composer-command-menu-empty">${escapeHtml(t("composer.commandMenu.empty"))}</div>`}
      </div>
    </div>
  `;
  composerCommandMenu.querySelectorAll(".composer-command-menu-item").forEach((button) => {
    button.addEventListener("mouseenter", () => {
      composerCommandMenuActiveIndex = Number(button.dataset.commandIndex || 0);
      syncComposerCommandMenuActiveItem();
    });
    button.addEventListener("click", () => {
      selectComposerCommand(Number(button.dataset.commandIndex || 0));
    });
  });
}

function updateComposerCommandHint() {
  ensureComposerCommandHint();
  if (!composerCommandHint) return;
  const kind = composerInputKind();
  composer?.classList.toggle("is-slash-input", kind === "slash");
  composerCommandHint.innerHTML = `
    <button type="button" class="composer-command-chip composer-command-open-btn ${kind === "slash" ? "is-active" : ""}" aria-haspopup="listbox" aria-expanded="${composerCommandMenuOpen ? "true" : "false"}">${escapeHtml(t("composer.input.slash"))}</button>
    <input class="composer-command-search" type="search" value="${escapeHtml(composerCommandSearchQuery)}" placeholder="${escapeHtml(t("composer.commandMenu.searchPlaceholder"))}" aria-label="${escapeHtml(t("composer.commandMenu.searchLabel"))}">
  `;
  const searchInput = composerCommandHint.querySelector(".composer-command-search");
  const openSearchMenu = () => {
    composerCommandSearchFocused = true;
    openComposerCommandMenu();
  };
  composerCommandHint.querySelector(".composer-command-open-btn")?.addEventListener("click", () => {
    openSearchMenu();
    searchInput?.focus();
  });
  searchInput?.addEventListener("focus", () => {
    openSearchMenu();
  });
  searchInput?.addEventListener("input", () => {
    composerCommandSearchFocused = true;
    composerCommandSearchQuery = searchInput.value;
    openComposerCommandMenu();
  });
  searchInput?.addEventListener("keydown", (event) => {
    handleComposerCommandMenuKeydown(event);
  });
  if (composerSlashQuery() !== null) {
    composerCommandMenuPinned = false;
    composerCommandMenuOpen = true;
    renderComposerCommandMenu();
  } else if (!composerCommandMenuPinned && !composerCommandSearchFocused) {
    closeComposerCommandMenu();
  }
}

function handleComposerCommandMenuKeydown(event) {
  if (!composerCommandMenuOpen) return false;
  const commands = filteredComposerSlashCommands();
  if (event.key === "Escape") {
    event.preventDefault();
    closeComposerCommandMenu();
    return true;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    composerCommandMenuActiveIndex = commands.length
      ? (composerCommandMenuActiveIndex + 1) % commands.length
      : 0;
    syncComposerCommandMenuActiveItem({ scrollIntoView: true });
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    composerCommandMenuActiveIndex = commands.length
      ? (composerCommandMenuActiveIndex - 1 + commands.length) % commands.length
      : 0;
    syncComposerCommandMenuActiveItem({ scrollIntoView: true });
    return true;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    return selectComposerCommand(composerCommandMenuActiveIndex);
  }
  return false;
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
  if (!activeSessionIds.has(session.id)) return t("composer.blockInactiveSession");
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
    const claudeCommand = window.prompt(t("runtimeConfig.promptClaudeCommand"), current?.claudeCommand || "");
    if (claudeCommand === null) return;
    const claudeArgs = window.prompt(t("runtimeConfig.promptClaudeArgs"), (current?.claudeArgs || []).join(" "));
    if (claudeArgs === null) return;
    const hermesHost = window.prompt(t("runtimeConfig.promptHermesHost"), current?.hermesHost || "wsl");
    if (hermesHost === null) return;
    const hermesCommand = window.prompt(t("runtimeConfig.promptHermesCommand"), current?.hermesCommand || "");
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
    setAppNotice(t("runtimeConfig.saved"));
    await refreshRuntimeProbe();
  } catch (error) {
    console.error(error);
    setAppNotice(t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
  }
}

function runtimeInstanceDetailMarkup(instance) {
  const lines = [];
  const addLine = (value) => {
    const text = String(value || "").trim();
    if (text && !lines.includes(text)) lines.push(text);
  };
  String(instance.detail || "")
    .split(/\r?\n/)
    .forEach(addLine);
  addLine(instance.version);
  return lines.map((line) => `<small>${escapeHtml(line)}</small>`).join("");
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
  stoppedSessionIds.delete(session.id);
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

function agentBriefRowMarkup(target, index) {
  const sendable = isTargetSendable(target);
  return `
    <article class="agent-brief-row" data-agent-id="${escapeHtml(target.id)}">
      <div class="agent-brief-row-header">
        <strong>${escapeHtml(targetDisplayName(target) || displayAgentName(target))}</strong>
        <button type="button" class="mini-btn ghost-btn agent-brief-row-fetch" data-agent-id="${escapeHtml(target.id)}" ${sendable ? "" : "disabled"}>${t("agentBrief.autoFetch")}</button>
      </div>
      <label>
        <span>${t("agentBrief.zhLabel")}</span>
        <input class="agent-brief-input" data-agent-id="${escapeHtml(target.id)}" data-language="zh-CN" name="brief-${index}-zh" value="${escapeHtml(targetBriefInputValue(target, "zh-CN"))}" placeholder="${escapeHtml(t(fallbackBriefKeyForTarget(target)))}" />
      </label>
      <label>
        <span>${t("agentBrief.enLabel")}</span>
        <input class="agent-brief-input" data-agent-id="${escapeHtml(target.id)}" data-language="en-US" name="brief-${index}-en" value="${escapeHtml(targetBriefInputValue(target, "en-US"))}" placeholder="${escapeHtml(t("agentBrief.placeholderEn"))}" />
      </label>
    </article>
  `;
}

async function saveBriefInputs(root) {
  const next = cloneAgentBriefs();
  root.querySelectorAll(".agent-brief-input").forEach((input) => {
    const target = agentById(input.dataset.agentId);
    if (!target) return;
    writeBriefValue(next, target, input.dataset.language, input.value, "manual");
  });
  await saveAgentBriefRecords(next);
  renderProviders();
}

function briefInputFor(root, targetId, language) {
  return [...root.querySelectorAll(".agent-brief-input")]
    .find((input) => input.dataset.agentId === targetId && input.dataset.language === language) || null;
}

async function autoFetchBriefButtons(root) {
  root.querySelectorAll(".agent-brief-row-fetch").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = agentById(button.dataset.agentId);
      if (!target) return;
      button.disabled = true;
      try {
        const result = await refreshAgentBriefForTarget(target);
        const zhInput = briefInputFor(root, target.id, "zh-CN");
        const enInput = briefInputFor(root, target.id, "en-US");
        if (zhInput) zhInput.value = result["zh-CN"];
        if (enInput) enInput.value = result["en-US"];
      } catch (error) {
        console.error(error);
        setAppNotice(t("agentBrief.fetchFailed", { error: formatBackendError(error) }), "error");
      } finally {
        button.disabled = !isTargetSendable(target);
      }
    });
  });
}

async function autoFetchProviderBriefs(providerId, root) {
  const targets = targetsForProvider(providerId).filter(isTargetSendable);
  if (!targets.length) {
    setAppNotice(t("agentBrief.noSendableTargets"), "error");
    return;
  }
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    setAppNotice(t("agentBrief.fetchingProgress", {
      current: index + 1,
      total: targets.length,
      target: targetDisplayName(target),
    }), "busy");
    const result = await refreshAgentBriefForTarget(target, { quiet: true });
    const zhInput = briefInputFor(root, target.id, "zh-CN");
    const enInput = briefInputFor(root, target.id, "en-US");
    if (zhInput) zhInput.value = result["zh-CN"];
    if (enInput) enInput.value = result["en-US"];
  }
  setAppNotice(t("agentBrief.fetchAllComplete", { count: targets.length }));
}

async function openAgentBriefManager(agentId) {
  const target = agentById(agentId);
  if (!target || !confirmDialog) return;
  try {
    await ensureRuntimeConfigState();
    confirmDialog.hidden = false;
    confirmDialog.innerHTML = `
      <form class="confirm-dialog agent-brief-dialog" role="dialog" aria-modal="true" aria-labelledby="agentBriefTitle">
        <div class="confirm-dialog-header">
          <span class="runtime-config-icon" aria-hidden="true">●</span>
          <div>
            <h3 id="agentBriefTitle">${t("agentBrief.title")}</h3>
            <p class="runtime-config-subtitle">${escapeHtml(targetDisplayName(target))}</p>
          </div>
          <button type="button" class="confirm-dialog-close agent-brief-close" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="runtime-config-body agent-brief-body">
          ${agentBriefRowMarkup(target, 0)}
        </div>
        <div class="confirm-dialog-actions runtime-config-actions">
          <button type="button" class="confirm-dialog-cancel agent-brief-close">${t("common.cancel")}</button>
          <button type="submit" class="primary">${t("common.save")}</button>
        </div>
      </form>
    `;
    confirmDialog.querySelectorAll(".agent-brief-close").forEach((button) => {
      button.addEventListener("click", closeConfirmDialog);
    });
    await autoFetchBriefButtons(confirmDialog);
    confirmDialog.querySelector(".agent-brief-dialog")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveBriefInputs(confirmDialog);
      closeConfirmDialog();
      setAppNotice(t("agentBrief.saved"));
    });
  } catch (error) {
    console.error(error);
    setAppNotice(t("agentBrief.openFailed", { error: formatBackendError(error) }), "error");
  }
}

function providerBriefSectionMarkup(providerId) {
  const targets = targetsForProvider(providerId);
  const rows = targets.map(agentBriefRowMarkup).join("");
  return `
    <section class="runtime-config-section agent-brief-section">
      <div class="agent-brief-section-header">
        <div>
          <h4>${t("agentBrief.sectionTitle")}</h4>
          <p>${t("agentBrief.sectionSubtitle")}</p>
        </div>
        <button type="button" class="mini-btn ghost-btn agent-brief-fetch-all" ${targets.some(isTargetSendable) ? "" : "disabled"}>${t("agentBrief.autoFetchAll")}</button>
      </div>
      <div class="agent-brief-list">${rows || `<p class="connection-empty">${t("provider.noTargets")}</p>`}</div>
      <button type="button" class="mini-btn agent-brief-save-all">${t("agentBrief.saveAll")}</button>
    </section>
  `;
}

async function openProviderManager(providerId = currentTargetProvider()?.id || "claude") {
  if (!confirmDialog) {
    await openProviderManagerPrompt();
    return;
  }
  try {
    const selectedProviderId = providerId || "claude";
    await ensureRuntimeConfigState();
    const selectedProvider = providerById(selectedProviderId) || { id: selectedProviderId, name: selectedProviderId };
    const selectedAvailability = providerAvailability(selectedProviderId);
    const selectedState = providerAvailabilityLabel(selectedAvailability.summary);
    const selectedStateClass = stateClasses[PROVIDER_AVAILABILITY_STATES[selectedAvailability.summary]?.state] || "state-idle";
    const title = selectedProviderId === "claude"
      ? t("runtimeConfig.claudeTitle")
      : selectedProviderId === "hermes"
        ? t("runtimeConfig.hermesTitle")
        : selectedProvider.name;
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
            ${runtimeInstanceDetailMarkup(instance)}
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
            <span>${escapeHtml(runtimeConnectionNote(selectedProvider, instances))}</span>
          </aside>
          <section class="runtime-config-section">
            <h4>${t("connection.detected")}</h4>
            <div class="connection-instance-list">${instanceMarkup}</div>
          </section>
          ${providerBriefSectionMarkup(selectedProviderId)}
        </div>
        <div class="confirm-dialog-actions runtime-config-actions">
          <button type="button" class="confirm-dialog-cancel runtime-config-close">${t("common.close")}</button>
          ${["claude", "hermes"].includes(selectedProviderId) ? `<button type="button" class="mini-btn ghost-btn runtime-config-legacy">${t("runtimeConfig.legacyPrompt")}</button>` : ""}
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
    await autoFetchBriefButtons(confirmDialog);
    confirmDialog.querySelector(".agent-brief-save-all")?.addEventListener("click", async () => {
      try {
        await saveBriefInputs(confirmDialog);
        setAppNotice(t("agentBrief.saved"));
      } catch (error) {
        console.error(error);
        setAppNotice(t("agentBrief.saveFailed", { error: formatBackendError(error) }), "error");
      }
    });
    confirmDialog.querySelector(".agent-brief-fetch-all")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await autoFetchProviderBriefs(selectedProviderId, confirmDialog);
      } catch (error) {
        console.error(error);
        setAppNotice(t("agentBrief.fetchFailed", { error: formatBackendError(error) }), "error");
      } finally {
        button.disabled = !targetsForProvider(selectedProviderId).some(isTargetSendable);
      }
    });
    confirmDialog.querySelector(".runtime-config-dialog")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const saveButton = event.currentTarget.querySelector(".runtime-config-save");
      saveButton.disabled = true;
      setAppNotice(t("connection.rechecking"), "busy");
      try {
        await refreshRuntimeProbe();
        if (selectedProviderId === "hermes") await loadHermesProfiles();
        closeConfirmDialog();
        setAppNotice(t("connection.checkComplete"));
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

function openAvailabilityModal() {
  if (!confirmDialog) return;

  const store = getAvailabilityStore();
  const data = store.getData();

  if (!data.lastCheck) {
    store.refresh(providers, runtimeInstances, currentTargetAgent());
  }

  const freshData = store.getData();
  const viewHtml = AvailabilityView(freshData, { showTitle: false, compact: true });

  confirmDialog.hidden = false;
  confirmDialog.innerHTML = `
    <form class="confirm-dialog availability-dialog" role="dialog" aria-modal="true" aria-labelledby="availabilityTitle">
      <div class="confirm-dialog-header">
        <span class="runtime-config-icon" aria-hidden="true">●</span>
        <div>
          <h3 id="availabilityTitle">${t("availability.title")}</h3>
          <p class="runtime-config-subtitle">${t("availability.subtitle")}</p>
        </div>
        <button type="button" class="confirm-dialog-close availability-close" aria-label="${t("common.close")}">×</button>
      </div>
      <div class="availability-dialog-body">
        ${viewHtml}
      </div>
      <div class="confirm-dialog-actions availability-actions">
        <button type="button" class="confirm-dialog-cancel availability-close">${t("common.close")}</button>
        <button type="button" class="mini-btn ghost-btn availability-copy">${t("availability.copyReport")}</button>
        <button type="submit" class="primary availability-recheck">${t("availability.recheck")}</button>
      </div>
    </form>
  `;

  confirmDialog.querySelectorAll(".availability-close").forEach((button) => {
    button.addEventListener("click", closeConfirmDialog);
  });

  confirmDialog.querySelector(".availability-copy")?.addEventListener("click", () => {
    const report = JSON.stringify(freshData, null, 2);
    navigator.clipboard?.writeText(report).then(() => {
      setAppNotice(t("availability.reportCopied"));
    }).catch(() => {
      setAppNotice(t("common.copyFailed"), "error");
    });
  });

  confirmDialog.querySelector(".availability-dialog")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recheckBtn = event.currentTarget.querySelector(".availability-recheck");
    recheckBtn.disabled = true;
    setAppNotice(t("availability.rechecking"), "busy");
    try {
      await refreshRuntimeProbe();
      store.refresh(providers, runtimeInstances, currentTargetAgent());
      const updatedData = store.getData();
      const updatedView = AvailabilityView(updatedData, { showTitle: false, compact: true });
      confirmDialog.querySelector(".availability-dialog-body").innerHTML = updatedView;
      setAppNotice(t("availability.checkComplete"));
    } catch (error) {
      setAppNotice(t("availability.checkFailed", { error: formatBackendError(error) }), "error");
    } finally {
      recheckBtn.disabled = false;
    }
  });
}

function showProviderAgents(provider) {
  const names = provider.agents.map((agent) => displayAgentName(agent)).join(t("common.listSeparator"));
  setAppNotice(t("provider.agentList", { provider: provider.name, agents: names }));
}

async function refreshRuntimeProbe() {
  try {
    const adapterResult = await invoke("load_adapters");
    const result = await invoke("runtime_probe");
    providersStore.batch(() => {
      providersStore.syncAdapterProviders(adapterResult?.adapters || []);
      providersStore.patchRuntimeAvailability(
        Object.fromEntries((result?.providers || []).map((item) => [item.providerId, item])),
      );
      providersStore.replaceRuntimeInstances(Array.isArray(result?.instances) ? result.instances : []);
      providersStore.pruneRuntimeTargetsByInstanceIds(
        runtimeInstances.filter((instance) => instance.available).map((instance) => instance.id),
      );
    });
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspaceStatus();
    getAvailabilityStore().refresh(providers, runtimeInstances, currentTargetAgent());
    [...new Set(runtimeInstances.filter((instance) => instance.available).map((instance) => instance.providerId))]
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

function latestActiveSessionForAgent(agentId) {
  return [...sessions]
    .filter((session) => session.agentId === agentId && activeSessionIds.has(session.id) && canSendToSession(session))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

function setCurrentTargetAgent(agentId) {
  const target = agentById(agentId);
  if (!isTargetSendable(target)) {
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
  const sendable = isTargetSendable(target);
  const selected = sendable && target.id === currentTargetAgentId;
  const status = target.status || targetStatusForFleet(target);
  const statusLabel = t(status.labelKey);
  const subtitle = targetBriefText(target);
  const name = displayAgentName(target);
  const shouldShowRuntimeLabel = target.runtimeLabel && !name.includes(target.runtimeLabel);
  const entryClass = selected ? "is-main-agent" : sendable ? "is-selectable" : "is-unavailable";
  const disabledAttrs = sendable
    ? ""
    : ` aria-disabled="true" title="${escapeHtml(targetSendBlockNotice(target))}"`;
  return `
    <div class="agent-entry ${entryClass}" data-agent-id="${target.id}" data-sendable="${String(sendable)}"${disabledAttrs}>
      <div class="agent-entry-top">
        <strong>${escapeHtml(name)}</strong>
        <span class="agent-entry-meta">
          <span class="target-status-dot ${escapeHtml(status.className)}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>
          ${shouldShowRuntimeLabel ? `<span class="target-runtime-label">${escapeHtml(target.runtimeLabel)}</span>` : ""}
          <button type="button" class="agent-brief-btn" data-agent-id="${escapeHtml(target.id)}" title="${t("agentBrief.manage")}" aria-label="${t("agentBrief.manage")}">⚙</button>
        </span>
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
    const availability = providerAvailability(provider.id);
    const providerStatus = providerStatusForFleet(provider, availability);
    const availabilityLabel = t(providerStatus.labelKey);
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
    const collapsed = collapsedProviderIds.has(provider.id);
    const collapseLabel = collapsed
      ? t("provider.expand", { provider: provider.name })
      : t("provider.collapse", { provider: provider.name });
    group.className = `provider-group ${providerStatus.mutedCard ? "is-muted-status" : ""}`;
    group.classList.toggle("is-collapsed", collapsed);

    group.innerHTML = `
      <div class="provider-header">
        <button type="button" class="provider-collapse-btn" data-provider-id="${provider.id}" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="provider-targets-${provider.id}" aria-label="${escapeHtml(collapseLabel)}" title="${escapeHtml(collapseLabel)}">
          <span class="provider-collapse-caret" aria-hidden="true">▸</span>
          <div class="provider-heading">
            <div class="provider-title-row">
              <strong>${renderProviderIcon(provider, { size: "13px" })}${provider.name}</strong>
              <span class="provider-status-square ${providerStatus.className}" title="${escapeHtml(availabilityLabel)}" aria-label="${escapeHtml(availabilityLabel)}"></span>
            </div>
            <div class="provider-meta-row">
              <span class="provider-count-badge">${escapeHtml(metaLabel)}</span>
              ${runtimeMiniLabel ? `<span class="provider-runtime-mini">${escapeHtml(runtimeMiniLabel)}</span>` : ""}
            </div>
          </div>
        </button>
        <button type="button" class="mini-btn ghost-btn provider-manage-btn provider-connection-icon-btn" data-provider-id="${provider.id}" title="${t("common.manage")}" aria-label="${t("common.manage")}">⚙</button>
      </div>
      <div class="provider-targets" id="provider-targets-${provider.id}" ${collapsed ? "hidden" : ""}>
        ${targetMarkup || `<div class="runtime-instance-empty">${emptyLabel}</div>`}
      </div>
    `;

    agentList.appendChild(group);
  });

  agentList.querySelectorAll(".provider-collapse-btn").forEach((button) => {
    button.addEventListener("click", () => {
      toggleProviderCollapsed(button.dataset.providerId);
    });
  });

  agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProviderManager(button.dataset.providerId);
    });
  });

  agentList.querySelectorAll(".agent-brief-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openAgentBriefManager(button.dataset.agentId);
    });
  });

  agentList.querySelectorAll(".agent-entry").forEach((entry) => {
    entry.addEventListener("click", () => {
      const agentId = entry.dataset.agentId;
      if (!agentId) return;
      const target = agentById(agentId);
      if (entry.dataset.sendable === "false" || !isTargetSendable(target)) {
        setAppNotice(targetSendBlockNotice(target), "error");
        return;
      }
      if (target.id === currentTargetAgentId) return;
      setCurrentTargetAgent(agentId);
    });
  });

}

function applyRuntimeTargetsForInstance(providerId, runtimeInstanceId, targets) {
  providersStore.batch(() => {
    providersStore.setRuntimeTargetsForInstance(runtimeInstanceId, targets);
    const count = providersStore.totalRuntimeTargetCount();
    if (providerById(providerId) && count > 0) {
      providersStore.setProviderNote(providerId, {
        note: null,
        noteKey: "provider.hermes.loadedNote",
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
    renderComposerCommandMenu();
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
    if (!loaded && providerId === "hermes") setAppNotice(t("provider.noHermesProfiles"));
  } catch (error) {
    console.error(error);
    setAppNotice(t("provider.runtimeTargetLoadFailed", { error: formatBackendError(error) }), "error");
  }
}

async function loadHermesProfiles(runtimeInstanceIds = null) {
  return loadRuntimeTargetsForProvider("hermes", runtimeInstanceIds);
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

function createSessionForAgent(agent, firstTask) {
  const provider = providerById(agent?.providerId);
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

function createSession(firstTask) {
  return createSessionForAgent(currentTargetAgent(), firstTask);
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
    finalResponse: t("turn.initialResponse"),
    logs: [t("turn.initialLog")],
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
  const message = `Hermes profile ${profileName} ${t("runtime.hermesStartupNotice")}`;
  session.acpStartupNoticeShown = true;
  if (!turn.logs.includes(message)) {
    turn.logs = [message, ...turn.logs];
  }
}


function getOrCreateActiveSession(task, forceNew = false) {
  const agent = currentTargetAgent();
  if (!agent) return null;
  const existing = !forceNew ? currentSession() : null;
  if (existing && existing.agentId !== agent.id) return createSession(task);
  if (existing && !activeSessionIds.has(existing.id)) return createSession(task);
  return existing || createSession(task);
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
  setAppNotice(t("runtime.failed", { agent: session.agentName, message }), "error");
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

function localizedFallbackEvents(events) {
  return events.map((event) => ({
    ...event,
    payload: {
      ...(event.payload || {}),
      content: event.contentKey ? t(event.contentKey) : event.payload?.content,
    },
  }));
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
  const countedSessions = sessions;
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





function isSessionLatestOnly(session) {
  return sessionLatestOnlyState.get(session.id) ?? false;
}

function toggleSessionLatestOnly(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  sessionLatestOnlyState.set(sessionId, !isSessionLatestOnly(session));
  renderWorkspace();
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
    `# ${t("turn.transcriptTitle", { index: index + 1 })}`,
    `user:\n${turn.task}`,
  ];
  if (turn.thoughts.length) parts.push(`${t("turn.thoughtStreamLabel")}:\n${turn.thoughts.join("\n\n")}`);
  const response = turnResponseText(turn);
  if (response) parts.push(`assistant:\n${response}`);
  if (turn.logs.length) parts.push(`${t("turn.runtimeStreamLabel")}:\n${turn.logs.join("\n")}`);
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
    // 折叠 flow 详情 — 双 V 朝上（ChevronsUp）
    collapse: `<path d="m7 12 5-5 5 5"></path><path d="m7 18 5-5 5 5"></path>`,
    // 展开 flow 详情 — 双 V 朝下（ChevronsDown）
    expand: `<path d="m7 6 5 5 5-5"></path><path d="m7 13 5 5 5-5"></path>`,
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

function turnCollapsedSummary(turn) {
  const response = turnResponseText(turn);
  const source = [turn.task, response].filter(Boolean).join(" · ");
  const compact = source.replace(/\s+/g, " ").trim();
  if (!compact) return t("turn.collapsedEmpty");
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
  setAppNotice(shouldExpand ? t("session.allTurnsExpanded") : t("session.allTurnsCollapsed"));
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

function isFlowDetailOpen(key, defaultOpen) {
  return flowDetailOpenState.get(key) ?? defaultOpen;
}

// 跟踪每个 turn 上一次 render 时的 streaming 状态，用于在 streaming → 终态切换时
// 清除该 turn 的所有 detail open 状态，让"运行中默认展开、结束默认收回"自动生效。
const prevTurnStreamingById = new Map();

function clearTurnDetailOpenState(turnId) {
  if (!turnId) return;
  const prefix = `${turnId}:`;
  const keysToDelete = [];
  for (const key of flowDetailOpenState.keys()) {
    if (typeof key === "string" && key.startsWith(prefix)) keysToDelete.push(key);
  }
  for (const key of keysToDelete) flowDetailOpenState.delete(key);
}

function renderTurn(turn, index) {
  const streaming = executingSessionStates.has(turn.state);
  const waiting = streaming && !turn.finalResponse;
  const rawResponseText = turnResponseText(turn);
  const responseText = rawResponseText || t("turn.waiting");
  const thoughtDetailKey = `${turn.id}:thoughts`;
  const logDetailKey = `${turn.id}:logs`;

  // 检测 streaming → 完成的状态转折，清除该 turn 的所有 detail open 状态，
  // 让 streaming 期默认展开、结束后默认收回的 fallback 接管。
  const prevStreaming = prevTurnStreamingById.get(turn.id);
  if (prevStreaming === true && !streaming) {
    clearTurnDetailOpenState(turn.id);
  }
  prevTurnStreamingById.set(turn.id, streaming);
  const collapsed = collapsedTurnIds.has(turn.id);
  const turnToggleLabel = collapsed ? t("action.expandTurn") : t("action.collapseTurn");

  const events = turnEventsFromTurn(turn, { translate: t, streaming });
  const thinkingEvent = events.find((event) => event.kind === "thinking");
  const processEvents = events.filter((event) => event.kind !== "thinking");
  const hasRunningProcess = processEvents.some((event) => event.status === "running");
  const eventViewOptions = {
    translate: t,
    escapeHtml,
    isOpenForKey: isFlowDetailOpen,
  };
  const thinkingHtml = thinkingEvent
    ? `<ul class="turn-events turn-events--thinking" role="list">${renderTurnEventItemHtml(
        { ...thinkingEvent, id: thoughtDetailKey },
        { ...eventViewOptions, detailsExtraClass: "turn-event-thinking-shell" },
      )}</ul>`
    : "";
  const processOpen = isFlowDetailOpen(logDetailKey, streaming);
  const processHtml = processEvents.length
    ? `<details class="terminal-detail turn-events-shell" data-detail-key="${escapeHtml(logDetailKey)}"${processOpen ? " open" : ""}>
        <summary class="turn-events-shell-summary">
          <span class="turn-event-dot ${hasRunningProcess ? "turn-event-status-running" : "turn-event-status-info"}" aria-hidden="true"></span>
          <span class="turn-events-shell-label">${t("turn.logs", { count: processEvents.length })}</span>
          <span class="turn-event-arrow" aria-hidden="true"></span>
        </summary>
        ${renderTurnEventsHtml(processEvents, eventViewOptions)}
      </details>`
    : "";

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
            <p>${escapeHtml(turn.task)}</p>
          </div>
          ${thinkingHtml}
          <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
            <div class="terminal-label">assistant</div>
            ${renderAssistantResponse(responseText, streaming ? "streaming" : "final")}
          </div>
          ${processHtml}
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
  const stats = sessionCardStats(session, t);
  const latestOnly = isSessionLatestOnly(session);
  const hasFlowDetails = flowDetailEntriesForSession(session).length > 0;
  const flowsOpen = areSessionFlowDetailsOpen(session);
  const turnsCollapsed = areSessionTurnsCollapsed(session);
  const { visibleTurnEntries, hiddenTurnCount } = sessionTurnVisibility(session, latestOnly);
  const managementTitleSuffix = isRestoring ? t("action.restoringSuffix") : "";
  const runtimeLabel = runtimeStateLabel(runtimeState);
  const canArchiveCard = runtimeState !== LIFECYCLE.archived && runtimeState !== LIFECYCLE.resume_failed;
  const turnToggleLabel = turnsCollapsed ? t("action.expandAllTurns") : t("action.collapseAllTurns");
  const latestOnlyLabel = latestOnly ? t("action.showAllTurns") : t("action.latestOnly");
  const flowToggleLabel = flowsOpen ? t("action.collapseFlows") : t("action.expandFlows");
  const fullscreenLabel = session.fullscreen ? t("action.exitFullscreen") : t("action.enterFullscreen");
  const identityTitle = sessionIdentityTitle(identitySession);
  const identityTitleMarkup = renderSessionIdentityTitle(identitySession);
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}" tabindex="0" aria-label="${escapeHtml(t("session.ariaSwitch", { task: session.task }))}" ${isActiveReceiver ? "aria-current=\"true\"" : ""}>
      <div class="session-card-header">
        <div class="session-card-row session-card-identity-line">
          <div class="session-agent-title">
            <strong title="${escapeHtml(identityTitle)}">${identityTitleMarkup}</strong>
            ${isActiveReceiver ? `<span class="active-receiver-banner">${t("session.current")}</span>` : ""}
          </div>
          <div class="session-card-actions" role="toolbar" aria-label="${t("session.actionsAria")}">
            ${isWaiting && runtimeState === "live" ? `<button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-stop-btn" data-session-id="${session.id}" title="${t("action.stop")}" aria-label="${t("action.stop")}">${renderSessionActionIcon("stop")}</button>` : ""}
            <div class="session-tool-group" role="group">
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="${t("action.copySession")}" aria-label="${t("action.copySession")}" ${session.turns.length ? "" : "disabled"}>${renderSessionActionIcon("copy")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnlyLabel}" aria-label="${latestOnlyLabel}" ${session.turns.length > 1 ? "" : "disabled"}>${renderSessionActionIcon(latestOnly ? "all" : "latest")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-toggle-flows-btn ${flowsOpen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${flowsOpen ? "true" : "false"}" title="${flowToggleLabel}" aria-label="${flowToggleLabel}" ${hasFlowDetails ? "" : "disabled"}>${renderSessionActionIcon(flowsOpen ? "collapse" : "expand")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="${t("action.scrollLatest")}" aria-label="${t("action.scrollLatest")}">${renderSessionActionIcon("latestScroll")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-fullscreen-btn ${session.fullscreen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${session.fullscreen ? "true" : "false"}" title="${fullscreenLabel}" aria-label="${fullscreenLabel}">${renderSessionActionIcon(session.fullscreen ? "fullscreenExit" : "fullscreen")}</button>
            </div>
            <div class="session-management-group" role="group">
              <button type="button" class="mini-btn ghost-btn session-action-btn session-dismiss-btn" data-session-id="${session.id}" title="${t("action.dismiss")}${managementTitleSuffix}" aria-label="${t("action.dismiss")}" ${managementDisabled}>${renderSessionActionIcon("dismiss")}</button>
              ${canArchiveCard ? `<button type="button" class="mini-btn ghost-btn session-action-btn session-archive-btn" data-session-id="${session.id}" title="${t("action.archive")}${managementTitleSuffix}" aria-label="${t("action.archive")}" ${managementDisabled}>${renderSessionActionIcon("archive")}</button>` : ""}
              <button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="${t("action.delete")}${managementTitleSuffix}" aria-label="${t("action.delete")}" ${managementDisabled}>${renderSessionActionIcon("delete")}</button>
              ${canRestoreSession(session) ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">${t("session.restoreRetry")}</button>` : ""}
            </div>
          </div>
        </div>
        <div class="session-card-row session-card-status-line">
          ${shouldShowRuntimeState ? `<span class="runtime-pill ${runtimeStateClasses[runtimeState] || "runtime-archived"} ${isWaiting ? "is-busy" : ""}" aria-label="${escapeHtml(t("session.statusAria", { state: runtimeLabel }))}">${escapeHtml(runtimeLabel)}</span>` : ""}
          <div class="session-card-stats" aria-label="${t("session.statsAria")}">
            <button type="button" class="session-stat-pill session-turns-toggle-btn ${turnsCollapsed ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${turnsCollapsed ? "true" : "false"}" title="${turnToggleLabel}" aria-label="${turnToggleLabel}" ${session.turns.length ? "" : "disabled"}>${t("session.turns", { count: session.turns.length })}</button>
            ${stats.map((item) => `<span class="session-stat-pill" data-stat-key="${escapeHtml(item.key)}">${escapeHtml(item.label)}</span>`).join("")}
          </div>
          ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
        </div>
        <div class="session-task-line" title="${escapeHtml(session.task)}" aria-label="${escapeHtml(t("session.task", { task: session.task }))}">
          <span class="session-task-label">${escapeHtml(t("session.taskLabel"))}</span>
          <span class="session-task-text">${escapeHtml(session.task)}</span>
        </div>
      </div>
      <div class="session-card-body">
        ${session.turns.length
          ? `${hiddenTurnCount ? `<div class="session-hidden-turns">${t("session.hiddenTurns", { count: hiddenTurnCount })}</div>` : ""}${visibleTurnEntries.map(({ turn, index }) => renderTurn(turn, index)).join("")}<div class="session-latest-anchor">${isWaiting ? t("session.latestAnchorStreaming") : t("session.latestAnchorLatest")}</div>`
          : `<p class='flow-empty'>${t("session.noMessages")}</p>`}
      </div>
    </article>
  `;
}

function focusSessionInWorkspace(sessionId) {
  let changed = false;
  sessions.forEach((session) => {
    const shouldBeFocused = session.id === sessionId;
    if (Boolean(session.fullscreen) !== shouldBeFocused) {
      session.fullscreen = shouldBeFocused;
      changed = true;
    }
  });
  if (!changed) return false;
  renderWorkspace();
  return true;
}

function toggleSessionFocus(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (session.fullscreen) {
    session.fullscreen = false;
    renderWorkspace();
    return;
  }
  focusSessionInWorkspace(sessionId);
}

function renderSessionMiniCard(session) {
  const identitySession = normalizeWorkspaceSession(session);
  const runtimeState = sessionRuntimeState(session);
  const isActive = sessionsStore.getCurrentSessionId() === session.id;
  const isWaiting = isSessionExecuting(session);
  const runtimeClass = runtimeStateClasses[runtimeState] || "runtime-archived";
  const taskPreview = (session.task || "").replace(/\s+/g, " ").trim();
  const previewText = taskPreview.length > 64 ? `${taskPreview.slice(0, 64)}\u2026` : taskPreview;
  const identityTitle = sessionIdentityTitle(identitySession);
  return `<button type="button" class="session-mini-card ${isActive ? "is-active" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${escapeHtml(session.id)}" title="${escapeHtml(identityTitle)}">
    <span class="session-mini-card-state runtime-pill ${runtimeClass} ${isWaiting ? "is-busy" : ""}" aria-hidden="true"></span>
    <span class="session-mini-card-body">
      <span class="session-mini-card-title">${escapeHtml(identityTitle)}</span>
      ${previewText ? `<span class="session-mini-card-task">${escapeHtml(previewText)}</span>` : ""}
    </span>
    <span class="session-mini-card-action" aria-hidden="true">\u21F1</span>
  </button>`;
}

function exitFullscreenSessions() {
  const fullscreenSessions = sessions.filter((session) => session.fullscreen);
  if (!fullscreenSessions.length) return false;
  fullscreenSessions.forEach((session) => {
    session.fullscreen = false;
  });
  renderWorkspace();
  setAppNotice(t("session.exitFullscreenNotice"));
  return true;
}

function bindSessionActions(root = sessionDeck) {
  const actionRoot = root || sessionDeck;
  const cards = actionRoot.matches?.(".session-card")
    ? [actionRoot]
    : [...actionRoot.querySelectorAll(".session-card")];
  cards.forEach((card) => {
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
  actionRoot.querySelectorAll(".session-fullscreen-btn").forEach((button) => {
    button.addEventListener("click", () => {
      toggleSessionFocus(button.dataset.sessionId);
    });
  });
  actionRoot.querySelectorAll(".session-mini-card").forEach((button) => {
    button.addEventListener("click", () => {
      focusSessionInWorkspace(button.dataset.sessionId);
      activateWorkspaceSession(button.dataset.sessionId);
    });
  });
  actionRoot.querySelectorAll(".session-dismiss-btn").forEach((button) => {
    button.addEventListener("click", () => dismissWorkspaceSession(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-archive-btn").forEach((button) => {
    button.addEventListener("click", () => archiveLiveSession(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-stop-btn").forEach((button) => {
    button.addEventListener("click", () => stopSession(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-delete-btn").forEach((button) => {
    button.addEventListener("click", () => requestDeleteConfirmation(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-retry-btn").forEach((button) => {
    button.addEventListener("click", () => restoreArchivedSession(button.dataset.sessionId));
  });
  actionRoot
    .querySelectorAll(".terminal-detail[data-detail-key], .turn-event-thinking-shell[data-detail-key]")
    .forEach((detail) => {
      detail.addEventListener("toggle", () => {
        flowDetailOpenState.set(detail.dataset.detailKey, detail.open);
      });
    });
  actionRoot.querySelectorAll(".session-scroll-latest-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId;
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
      if (!body) return;
      const controller = sessionStickRegistry.ensure(sessionId, body, { initialStuck: true });
      controller.scrollToBottom();
    });
  });
  actionRoot.querySelectorAll(".session-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionId);
      const text = session ? sessionTranscriptText(session) : "";
      if (!text) {
        setAppNotice(t("session.noTranscript"), "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? t("session.copiedTranscript") : t("copy.selectManually"), copied ? "muted" : "error");
    });
  });
  actionRoot.querySelectorAll(".session-latest-only-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSessionLatestOnly(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-turns-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSessionTurnsCollapsed(button.dataset.sessionId));
  });
  actionRoot.querySelectorAll(".session-toggle-flows-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionId);
      if (!session) return;
      const shouldOpen = !areSessionFlowDetailsOpen(session);
      setSessionFlowDetails(session.id, shouldOpen);
      setAppNotice(shouldOpen ? t("session.flowsExpanded") : t("session.flowsCollapsed"));
    });
  });
  actionRoot.querySelectorAll(".turn-collapse-btn").forEach((button) => {
    button.addEventListener("click", () => toggleTurnCollapsed(button.dataset.turnId));
  });
  actionRoot.querySelectorAll(".turn-copy-response-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = findTurnById(button.dataset.turnId);
      const text = result ? turnResponseText(result.turn) : "";
      if (!text) {
        setAppNotice(t("turn.noResponseCopy"), "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? t("turn.copiedResponse") : t("copy.selectManually"), copied ? "muted" : "error");
    });
  });
  actionRoot.querySelectorAll(".turn-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = findTurnById(button.dataset.turnId);
      const text = result ? turnTranscriptText(result.turn, result.turnIndex) : "";
      if (!text) {
        setAppNotice(t("turn.noTranscript"), "busy");
        return;
      }
      const copied = await copyTextToClipboard(text);
      setAppNotice(copied ? t("turn.copiedTranscript") : t("copy.selectManually"), copied ? "muted" : "error");
    });
  });
  actionRoot.querySelectorAll(".md-code-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
      if (!code) {
        setAppNotice(t("markdown.emptyCode"), "busy");
        return;
      }
      const copied = await copyTextToClipboard(code);
      setAppNotice(copied ? t("markdown.copiedCode") : t("markdown.copyCodeFailed"), copied ? "muted" : "error");
    });
  });
}

function activateWorkspaceSession(sessionId, options = {}) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  saveCurrentTargetAgent(session.agentId);
  saveCurrentSession(session.id);
  sendAsNewSession = false;
  if (canSendToSession(session)) markSessionActive(session.id);
  updateActionLabels();
  renderProviders();
  renderWorkspace({ focusSessionId: options.focusWorkspace ? session.id : null });
  renderHistory({ scrollSessionId: session.id });
  const runtimeState = sessionRuntimeState(session);
  setAppNotice(canSendToSession(session)
    ? t("session.activated", { task: session.task })
    : runtimeState === "restoring"
      ? t("session.restoringFocused")
      : t("session.readOnlySwitchBlocked"));
  focusComposerInput();
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

async function shutdownRuntimeSession(session) {
  const commands = acpCommandsForProvider(session.providerId);
  if (!commands) return false;
  return invoke(commands.shutdown, acpInvokeArgs(commands, session.providerId, { runtimeSessionId: session.id }));
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
  if (!turn.finalResponse || turn.finalResponse === t("turn.initialResponse")) {
    turn.finalResponse = t("turn.stoppedResponse");
  }
  turn.logs = [t("turn.stoppedLog"), ...turn.logs];
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
  setAppNotice(t("session.archivedNotice", { agent: session.agentName }));
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
    setAppNotice(t("session.stopRestoringBlocked"), "busy");
    return;
  }
  if (runtimeState !== "live") {
    setAppNotice(t("session.stopNoLiveRuntime"), "busy");
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
  setAppNotice(t("session.stoppedNotice", { agent: session.agentName }));
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
  const wasArchived = isArchivedLifecycle(runtimeState);
  if (runtimeState === "restoring") {
    setAppNotice(t("session.dismissRestoringBlocked"), "busy");
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
  setAppNotice(wasArchived
    ? t("session.dismissedArchived", { agent: removed.agentName })
    : t("session.dismissedActive", { agent: removed.agentName }));
}

async function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const runtimeState = session ? sessionRuntimeState(session) : archived?.runtimeState || "archived";
  if (runtimeState === "restoring") {
    setAppNotice(t("session.deleteRestoringBlocked"), "busy");
    return;
  }
  if (!session && !archived) return;
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
    renderWorkspace();
    renderHistory();
    const skipped = result?.skippedFiles ? t("session.deleteSkippedFiles", { count: result.skippedFiles }) : "";
    setAppNotice(t("session.deleted", { count: result?.removedCount || 0, skipped }));
  } catch (error) {
    console.error(error);
    setAppNotice(t("session.deleteFailed", { error: formatBackendError(error) }), "error");
  }
}

function requestDeleteConfirmation(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const title = session?.task || archived?.title || t("confirm.sessionFallback");
  openConfirmDialog({
    title: t("confirm.deleteSessionTitle"),
    message: t("confirm.deleteSessionMessage", { title }),
    confirmLabel: t("common.delete"),
    onConfirm: () => deleteSession(sessionId),
  });
}

function renderWorkspace(options = {}) {
  const focusSessionId = options.focusSessionId || null;
  const preserveDeckScroll = options.preserveDeckScroll === true;
  const deckScrollLeft = sessionDeck.scrollLeft;
  const deckScrollTop = sessionDeck.scrollTop;
  const stickyIntent = sampleSessionStickyIntent();
  const workspaceSessions = sessions;
  const visibleSessions = [...workspaceSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  updatePromptPlaceholder();
  renderWorkspaceStatus();
  workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
  if (!visibleSessions.length) updateWorkspaceEmptyCopy();
  sessionDeck.classList.toggle("is-single-session", visibleSessions.length === 1);
  sessionDeck.classList.toggle("is-two-sessions", visibleSessions.length === 2);
  sessionDeck.classList.toggle("is-many-sessions", visibleSessions.length > 2);
  const explicitFocusSession = visibleSessions.find((session) => session.fullscreen);
  const focusedSession = explicitFocusSession || (visibleSessions.length === 1 ? visibleSessions[0] : null);
  sessionDeck.classList.toggle("is-focused", Boolean(focusedSession));
  sessionDeck.classList.toggle("is-implicit-focused", Boolean(focusedSession && !explicitFocusSession));
  if (focusedSession) {
    sessionDeck.innerHTML = `
      ${renderSessionCard(focusedSession)}
      ${visibleSessions.length > 1
        ? `<div class="session-mini-bar" role="region" aria-label="${escapeHtml(t("session.miniBarAria"))}">
            ${visibleSessions.map((session) => renderSessionMiniCard(session)).join("")}
          </div>`
        : ""}
    `;
  } else {
    sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
  }
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
let pendingCardRenderTimer = 0;
let lastCardRenderAt = 0;

function scheduleSessionCardRender(sessionId) {
  if (!sessionId) return;
  pendingCardRenders.add(sessionId);
  if (pendingCardRenderFrame || pendingCardRenderTimer) return;
  const elapsed = Date.now() - lastCardRenderAt;
  const delayMs = Math.max(0, STREAM_CARD_RENDER_INTERVAL_MS - elapsed);
  const requestCardRender = () => {
    pendingCardRenderTimer = 0;
    pendingCardRenderFrame = requestAnimationFrame(() => {
      lastCardRenderAt = Date.now();
      pendingCardRenderFrame = 0;
      flushPendingSessionCardRenders();
    });
  };
  if (delayMs > 0) {
    pendingCardRenderTimer = window.setTimeout(requestCardRender, delayMs);
    return;
  }
  requestCardRender();
}

function flushPendingSessionCardRenders() {
  if (!pendingCardRenders.size) return;
  const targets = [...pendingCardRenders];
  pendingCardRenders.clear();
  targets.forEach((id) => renderSessionCardInPlace(id));
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
  card.replaceWith(newArticle);
  bindSessionActions(newArticle);
  renderMermaidDiagrams(newArticle).catch((error) => console.error(error));
  const newBody = newArticle.querySelector(".session-card-body");
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
  return [...historyEntries];
}



function sessionListItems() {
  const sourceSessions = sessions;
  const liveItems = sourceSessions.map((session) => {
    const identitySession = normalizeWorkspaceSession(session);
    const lastTurn = session.turns.at(-1);
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
      agentId: identitySession.agentId,
      runtimeInstanceId: identitySession.runtimeInstanceId || null,
      targetId: identitySession.targetId || identitySession.agentId,
      acpSessionId: session.acpSessionId || null,
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
  return [...liveItems, ...historyItems];
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
  const activeItems = sessionItems.filter(isActiveSessionListItem).sort(compareActiveSessionListItems);
  const archivedItems = sessionItems.filter(isArchivedSessionListItem).sort(compareArchivedSessionListItems);
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
  const isResumeFailed = item.runtimeState === LIFECYCLE.resume_failed;
  const signalClass = isResumeFailed
    ? "signal-failed"
    : isActiveHistoryItem || item.isInWorkspace
    ? "signal-workspace"
    : isArchived
      ? "signal-archive"
      : "signal-active";
  const signalLabel = isResumeFailed
    ? t("history.signal.failed")
    : isActiveHistoryItem
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
        <strong class="history-tool-name"><span class="history-signal ${signalClass}" title="${escapeHtml(signalLabel)}" aria-label="${escapeHtml(signalLabel)}"></span>${renderProviderIcon(providerById(item.providerId) || { id: item.providerId, name: item.providerName })}${escapeHtml(item.providerName)}</strong>
        <div class="history-item-actions">
          ${shouldShowState ? `<span class="history-state-pill ${runtimeStateClasses[item.runtimeState] || ""}">${escapeHtml(stateLabel)}</span>` : ""}
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
      openArchivedTranscript(item.dataset.sessionId);
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
      name: archived.agentName.split(" / ").at(-1) || t("session.historyAgentName"),
      subtitle: t("session.historyAgentSubtitle"),
      note: t("session.historyAgentNote"),
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

function workspaceSessionFromArchived(archived, existing = null) {
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
    restored.runtimeCommand = restored.runtimeCommand
      || (restoredInstance.commandKind === "manifest" ? null : restoredInstance.command)
      || null;
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
  return restored;
}

function openArchivedTranscript(sessionId) {
  if (!sessionId) return;
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  if (!archived) return;
  const existing = sessions.find((item) => item.id === archived.id);
  if (existing && sessionRuntimeState(existing) === "restoring") {
    activateWorkspaceSession(existing.id, { focusWorkspace: true });
    setAppNotice(t("archive.restoring"), "busy");
    return;
  }
  const restored = workspaceSessionFromArchived(archived, existing);
  if (!existing) sessionsStore.upsertHead(restored);
  markSessionInactive(restored.id);
  saveCurrentTargetAgent(restored.agentId);
  saveCurrentSession(restored.id);
  renderProviders();
  renderWorkspace({ focusSessionId: restored.id });
  renderHistory({ scrollSessionId: restored.id });
  setAppNotice(restored.acpSessionId
    ? t("archive.openedRestorable")
    : t("archive.openedReadOnly"));
  focusComposerInput();
}

async function restoreArchivedSession(sessionId) {
  if (!sessionId) return;
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  if (!archived) return;
  const existing = sessions.find((item) => item.id === archived.id);
  if (existing && sessionRuntimeState(existing) === "restoring") {
    setAppNotice(t("archive.restoring"), "busy");
    return;
  }
  const restored = workspaceSessionFromArchived(archived, existing);
  const restoreIntentId = ++restoreIntentSeq;
  const restoreStillFocused = () => restoreIntentId === restoreIntentSeq && sessionsStore.getCurrentSessionId() === restored.id;
  const renderRestoreUpdate = () => {
    const focused = restoreStillFocused();
    renderWorkspace(focused ? {} : { preserveDeckScroll: true });
    renderHistory(focused ? { scrollSessionId: restored.id } : {});
  };
  if (!existing) sessionsStore.upsertHead(restored);
  sessionsStore.unmarkStopped(restored.id);
  saveCurrentTargetAgent(restored.agentId);
  saveCurrentSession(restored.id);
  renderProviders();
  renderWorkspace();
  renderHistory();
  focusComposerInput();
  if (!restored.acpSessionId) {
    setSessionLifecycle(restored, LIFECYCLE.archived);
    markSessionInactive(restored.id);
    renderWorkspace();
    renderHistory();
    setAppNotice(t("restore.readOnlyMissingSession"));
    return;
  }
  setSessionLifecycle(restored, LIFECYCLE.restoring);
  renderWorkspace();
  renderHistory();
  setAppNotice(t("restore.starting"), "busy");
  const commands = acpCommandsForProvider(restored.providerId);
  if (!commands) {
    setSessionLifecycle(restored, LIFECYCLE.archived);
    markSessionInactive(restored.id);
    renderRestoreUpdate();
    setAppNotice(t("restore.unsupportedProvider"));
    return;
  }
  try {
    await invoke(commands.load, acpInvokeArgs(commands, restored.providerId, {
      runtimeSessionId: restored.id,
      acpSessionId: restored.acpSessionId,
      cwd: null,
      runtimeHost: restored.runtimeHost || null,
      runtimeCommand: restored.runtimeCommand || null,
      profileExecutable: restored.profileExecutable || null,
    }));
    setSessionLifecycle(restored, LIFECYCLE.live);
    markSessionActive(restored.id);
    renderRestoreUpdate();
    setAppNotice(t("restore.reconnected"));
  } catch (loadError) {
    const formattedLoadError = formatBackendError(loadError);
    try {
      await invoke(commands.shutdown, acpInvokeArgs(commands, restored.providerId, { runtimeSessionId: restored.id }));
    } catch (shutdownError) {
      console.error(shutdownError);
    }
    try {
      await invoke(commands.resume, acpInvokeArgs(commands, restored.providerId, {
        runtimeSessionId: restored.id,
        acpSessionId: restored.acpSessionId,
        cwd: null,
        runtimeHost: restored.runtimeHost || null,
        runtimeCommand: restored.runtimeCommand || null,
        profileExecutable: restored.profileExecutable || null,
      }));
      setSessionLifecycle(restored, LIFECYCLE.live);
      markSessionActive(restored.id);
      renderRestoreUpdate();
      setAppNotice(t("restore.loadFailedResumed"));
    } catch (resumeError) {
      const formattedResumeError = formatBackendError(resumeError || loadError);
      appendRuntimeLogToSession(
        restored,
        [
          t("restore.failedLogHeader"),
          t("restore.loadFailedLine", { error: formattedLoadError }),
          t("restore.resumeFailedLine", { error: formattedResumeError }),
        ].join("\n"),
        9,
      );
      setSessionLifecycle(restored, LIFECYCLE.resume_failed);
      markSessionInactive(restored.id);
      renderRestoreUpdate();
      setAppNotice(t("restore.failedNotice", { error: compactNoticeText(formattedResumeError) }), "error");
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
    setAppNotice(t("history.loadFailed"), "error");
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
  setAppNotice(t("runtime.sentNotice", { agent: session.agentName }), "busy");
  try {
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    const saved = updateTurnFromEvents(session.id, turn.id, localizedFallbackEvents(fallback.events));
    if (isSessionDeletedTombstone(session.id) || isSessionStoppedTombstone(session.id)) return;
    if (saved) {
      await saveTurnToHistory(session, saved);
      setAppNotice(t("runtime.completedSaved", { agent: session.agentName }));
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
  setAppNotice(t("runtime.sentNotice", { agent: session.agentName }), "busy");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke(commands.prompt, acpInvokeArgs(commands, session.providerId, {
      runtimeSessionId: session.id,
      prompt: turn.task,
      cwd: null,
      runtimeHost: session.runtimeHost || null,
      runtimeCommand: session.runtimeCommand || null,
      profileExecutable: session.profileExecutable || null,
    }));
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
      setAppNotice(t("runtime.completedSaved", { agent: session.agentName }));
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
  const task = promptBox.value.trim();
  if (!task) {
    promptBox.focus();
    return;
  }

  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  if (!agent || !provider) {
    setAppNotice(t("composer.needTargetBeforeSend"), "error");
    return;
  }
  if (!isTargetSendable(agent)) {
    setAppNotice(targetSendBlockNotice(agent), "error");
    promptBox.focus();
    return;
  }
  if (!canSendToProvider(provider.id)) {
    const availability = providerAvailability(provider.id);
    const label = providerAvailabilityLabel(availability.summary);
    setAppNotice(t("composer.providerUnavailable", { provider: provider.name, state: label }), "error");
    return;
  }

  const selectedSession = currentSession();
  const composingNewSession = forceNewSession || isComposingNewSession();
  const blockReason = !composingNewSession ? currentSessionSendBlockReason(selectedSession, agent) : "";
  if (blockReason) {
    setAppNotice(blockReason, "error");
    promptBox.focus();
    return;
  }

  const session = getOrCreateActiveSession(task, composingNewSession);
  if (!session) return;
  saveCurrentSession(session.id);
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
  openAvailabilityModal();
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

promptBox.addEventListener("keydown", (event) => {
  if (handleComposerCommandMenuKeydown(event)) return;
  if (event.key !== "Enter" || event.isComposing) return;
  const shouldSend = sendMode === "enter"
    ? !event.ctrlKey && !event.shiftKey && !event.altKey
    : event.ctrlKey && !event.shiftKey && !event.altKey;
  if (!shouldSend) return;
  event.preventDefault();
  startSessionFromPrompt(sendAsNewSession);
});

promptBox.addEventListener("input", () => {
  composerCommandSearchFocused = false;
  updateComposerCommandHint();
});

document.addEventListener("pointerdown", (event) => {
  if (!composerCommandMenuOpen) return;
  if (composer?.contains(event.target)) return;
  closeComposerCommandMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (composerCommandMenuOpen) {
    closeComposerCommandMenu();
    event.preventDefault();
    return;
  }
  if (exitFullscreenSessions()) event.preventDefault();
});

newSessionToggle.addEventListener("click", () => {
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
      if (commands) {
        aliveByProvider[providerId] = new Set(
          await invoke(commands.aliveIds, acpInvokeArgs(commands, providerId)),
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
        activeSessionIds.delete(session.id);
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
