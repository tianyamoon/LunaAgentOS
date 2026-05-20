const { invoke } = window.__TAURI__.core;
const listenRuntimeEvent = window.__TAURI__?.event?.listen?.bind(window.__TAURI__.event);

const stateNames = {
  0: "INIT",
  1: "IDLE",
  2: "THINK",
  3: "TOOLING",
  4: "RESP",
  5: "DONE",
  9: "ERROR",
};

const stateClasses = {
  0: "state-init",
  1: "state-idle",
  2: "state-think",
  3: "state-tooling",
  4: "state-resp",
  5: "state-done",
  9: "state-error",
};

const runtimeStateLabels = {
  live: "可续聊",
  archived: "只读",
  restoring: "重连中",
  resume_failed: "重连失败",
};

const runtimeStateClasses = {
  live: "runtime-live",
  archived: "runtime-archived",
  restoring: "runtime-restoring",
  resume_failed: "runtime-failed",
};

const executingSessionStates = new Set([0, 2, 3, 4]);

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

const providers = [
  {
    id: "claude",
    name: "Claude Code",
    lane: "强大入口",
    note: "当前唯一接通真实 CLI 任务执行链路的主入口。",
    agents: [
      {
        id: "claude-main",
        providerId: "claude",
        name: "主会话",
        subtitle: "Windows CLI",
        note: "适合承接高价值任务与真实产品演示。",
        state: 1,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    lane: "通用入口",
    note: "通过 WSL ACP 接入官方会话协议。",
    agents: [
      {
        id: "hermes-main",
        providerId: "hermes",
        name: "主会话",
        subtitle: "WSL Runtime",
        note: "适合作为通用样板与后续多会话扩展对象。",
        state: 1,
      },
    ],
  },
  {
    id: "trae",
    name: "Trae IDE",
    lane: "免费入口",
    note: "产品必须纳入，但当前坚持走 Bridge 路线。",
    agents: [
      {
        id: "trae-main",
        providerId: "trae",
        name: "主会话",
        subtitle: "IDE Bridge",
        note: "作为免费入口保留产品位，等待独立桥接。",
        state: 1,
      },
    ],
  },
];

const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const SEND_MODE_KEY = "lunaagentos.sendMode";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const HISTORY_SCHEMA_VERSION = 2;
const DEFAULT_HERMES_AGENT_ID = "hermes-profile-default";
const SEND_MODE_OPTIONS = ["enter", "ctrlEnter"];
const FONT_SCALE_OPTIONS = [
  { id: "compact", label: "字体：紧凑", scale: 0.92 },
  { id: "default", label: "字体：标准", scale: 1 },
  { id: "comfortable", label: "字体：舒展", scale: 1.08 },
];

const agentList = document.getElementById("agentList");
const providerManagerBtn = document.getElementById("providerManagerBtn");
const workspaceStatus = document.getElementById("workspaceStatus");
const workspaceEmpty = document.getElementById("workspaceEmpty");
const sessionDeck = document.getElementById("sessionDeck");
const historyList = document.getElementById("historyList");
const appNotice = document.getElementById("appNotice");
const promptBox = document.getElementById("promptBox");
const newSessionToggle = document.getElementById("newSessionToggle");
const sendBtn = document.getElementById("sendBtn");
const sendModeBtn = document.getElementById("sendModeBtn");
const fontScaleBtn = document.getElementById("fontScaleBtn");

let currentTargetAgentId = localStorage.getItem(CURRENT_TARGET_AGENT_KEY) || localStorage.getItem(LEGACY_TARGET_AGENT_KEY) || "claude-main";
let currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY) || null;
let sessions = [];
let activeSessionIds = new Set();
let historyEntries = [];
let sessionSeq = 0;
let turnSeq = 0;
let runningSessions = 0;
let isHistoryLoading = true;
let sendAsNewSession = false;
let sendMode = localStorage.getItem(SEND_MODE_KEY) || "enter";
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";
const flowDetailOpenState = new Map();
const sessionLatestOnlyState = new Map();

function allAgents() {
  return providers.flatMap((provider) => provider.agents);
}

function providerById(id) {
  return providers.find((provider) => provider.id === id);
}

function ensureCurrentTargetAgentExists() {
  if (agentById(currentTargetAgentId)) return;
  if (agentById(DEFAULT_HERMES_AGENT_ID)) {
    saveCurrentTargetAgent(DEFAULT_HERMES_AGENT_ID);
    return;
  }
  if (agentById("claude-main")) {
    saveCurrentTargetAgent("claude-main");
    return;
  }
  const fallbackAgent = allAgents()[0];
  if (fallbackAgent) saveCurrentTargetAgent(fallbackAgent.id);
}

function agentById(id) {
  return allAgents().find((agent) => agent.id === id);
}

function providerForAgent(agentId) {
  const agent = agentById(agentId);
  return agent ? providerById(agent.providerId) : null;
}

function currentTargetAgent() {
  return agentById(currentTargetAgentId);
}

function currentTargetProvider() {
  return providerForAgent(currentTargetAgentId);
}

function acpCommandsForProvider(providerId) {
  return acpRuntimeCommands[providerId] || null;
}

function providerState(provider) {
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

function formatTime(value) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSessionStatus(session) {
  return stateNames[session.state] || "UNKNOWN";
}

function sessionRuntimeState(session) {
  return session.runtimeState || "live";
}

function canSendToSession(session) {
  return sessionRuntimeState(session) === "live";
}

function canRestoreSession(session) {
  const state = sessionRuntimeState(session);
  return state === "archived" || state === "resume_failed";
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
    RUNTIME_NOT_FOUND: "未找到运行时，请确认 Claude/ACP adapter 可用",
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

function updateActionLabels() {
  const sending = runningSessions > 0;
  sendBtn.textContent = sending ? "发送中" : "发送";
  sendBtn.disabled = sending;
  newSessionToggle.disabled = sending;
  newSessionToggle.classList.toggle("is-active", sendAsNewSession);
  newSessionToggle.setAttribute("aria-pressed", String(sendAsNewSession));
}

function saveCurrentTargetAgent(agentId) {
  currentTargetAgentId = agentId;
  localStorage.setItem(CURRENT_TARGET_AGENT_KEY, agentId);
  localStorage.removeItem(LEGACY_TARGET_AGENT_KEY);
}

function saveCurrentSession(sessionId) {
  currentSessionId = sessionId || null;
  if (currentSessionId) localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId);
  else localStorage.removeItem(CURRENT_SESSION_KEY);
}

function markSessionActive(sessionId) {
  if (sessionId) activeSessionIds.add(sessionId);
}

function markSessionInactive(sessionId) {
  if (sessionId) activeSessionIds.delete(sessionId);
}

function clearCurrentSessionIf(sessionId) {
  if (currentSessionId === sessionId) saveCurrentSession(null);
}

function currentSession() {
  return currentSessionId ? sessions.find((session) => session.id === currentSessionId) || null : null;
}

function currentFontScaleOption() {
  return FONT_SCALE_OPTIONS.find((item) => item.id === fontScaleId) || FONT_SCALE_OPTIONS[1];
}

function applyFontScale() {
  const option = currentFontScaleOption();
  document.documentElement.style.setProperty("--ui-scale", String(option.scale));
  if (fontScaleBtn) fontScaleBtn.textContent = option.label;
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
  sendModeBtn.textContent = sendMode === "enter" ? "Enter 发送" : "Ctrl+Enter";
}

function toggleSendMode() {
  const index = SEND_MODE_OPTIONS.indexOf(sendMode);
  sendMode = SEND_MODE_OPTIONS[(index + 1) % SEND_MODE_OPTIONS.length];
  localStorage.setItem(SEND_MODE_KEY, sendMode);
  updateSendModeLabel();
}

function openProviderManager() {
  setAppNotice("Provider 管理器入口已预留，当前阶段先稳住发送目标与多会话工作台。");
}

function showProviderAgents(provider) {
  const names = provider.agents.map((agent) => agent.name).join("、");
  setAppNotice(`${provider.name} 当前已登记的 Agent：${names}。`);
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
  if (agent && provider) {
    workspaceStatus.textContent = `当前发送目标：${provider.name} / ${agent.name}`;
    setAppNotice(`当前发送目标已切换到 ${provider.name} / ${agent.name}。`);
  }
  renderProviders();
  renderWorkspace();
}

function renderProviders() {
  ensureCurrentTargetAgentExists();
  agentList.innerHTML = "";

  providers.forEach((provider) => {
    const group = document.createElement("section");
    group.className = "provider-group";
    const aggregateState = providerState(provider);

    group.innerHTML = `
      <div class="provider-header">
        <div>
          <div class="provider-title-row">
            <strong>${provider.name}</strong>
            <span class="state-pill ${stateClasses[aggregateState] || "state-idle"}">${stateNames[aggregateState]}</span>
          </div>
          <div class="provider-lane">${provider.lane}</div>
        </div>
        <button type="button" class="mini-btn ghost-btn provider-manage-btn" data-provider-id="${provider.id}">维护</button>
      </div>
      <p class="caption provider-note">${provider.note}</p>
      <div class="provider-agents">
        ${provider.agents.map((agent) => `
          <div class="agent-entry ${agent.id === currentTargetAgentId ? "is-main-agent" : "is-selectable"}" data-agent-id="${agent.id}">
            <div class="agent-entry-top">
              <strong>${agent.name}</strong>
            </div>
            <div class="agent-entry-sub">${agent.subtitle}</div>
            ${agent.id === currentTargetAgentId
              ? ""
              : `<div class="agent-entry-actions"><span class="agent-action-hint">设为发送目标</span></div>`}
          </div>
        `).join("")}
      </div>
    `;

    agentList.appendChild(group);
  });

  agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProviderManager();
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
  hermesProvider.agents = profiles.map((profile) => ({
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
  }));
  hermesProvider.note = `已载入 ${profiles.length} 个 Hermes profile。`;
  ensureCurrentTargetAgentExists();
  renderProviders();
  renderWorkspace();
  setAppNotice(`已载入 ${profiles.length} 个 Hermes profile。`);
}

async function loadHermesProfiles() {
  try {
    const profiles = await invoke("runtime_hermes_profiles");
    if (Array.isArray(profiles) && profiles.length) {
      applyHermesProfiles(profiles);
      return;
    }
    setAppNotice("未探测到可用的 Hermes profile，暂时保留默认入口。");
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

function sessionSectionsFromEvents(events) {
  const sections = {
    thoughts: [],
    outputs: [],
    finalResponse: "",
    logs: [],
  };
  let thoughtText = "";
  let outputText = "";

  events.forEach((event) => {
    const content = eventContentText(event);
    if (!content) return;

    if (event.type === "thought") {
      thoughtText += content;
      return;
    }

    if (event.type === "response") {
      outputText += content;
      sections.finalResponse = outputText;
      return;
    }

    if (event.type === "state" && event.state === 5) {
      if (!sections.finalResponse) {
        sections.finalResponse = content;
      } else if (content.trim() === sections.finalResponse.trim()) {
        return;
      } else {
        sections.logs.push(content);
      }
      return;
    }

    if (event.type === "state" && (event.state === 0 || event.state === 1 || event.state === 2)) {
      return;
    }

    sections.logs.push(content);
  });

  if (thoughtText.trim()) {
    sections.thoughts.push(thoughtText.trim());
  }
  if (outputText.trim()) {
    sections.outputs.push(outputText.trim());
    sections.finalResponse = outputText.trim();
  }

  return sections;
}

function eventContentText(event) {
  const content = event.payload?.content;
  if (typeof content === "string") return content;
  if (!content) return eventLogText(event);
  if (Array.isArray(content)) {
    return content
      .map(contentPartText)
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "object") {
    return contentPartText(content) || eventLogText(event);
  }
  return String(content);
}

function contentPartText(part) {
  if (!part) return "";
  if (typeof part === "string") return part;
  if (typeof part === "number" || typeof part === "boolean") return String(part);
  if (Array.isArray(part)) return part.map(contentPartText).filter(Boolean).join("\n");
  if (typeof part === "object") {
    if (typeof part.text === "string") return part.text;
    if (typeof part.content === "string") return part.content;
    if (Array.isArray(part.content)) return part.content.map(contentPartText).filter(Boolean).join("\n");
    if (typeof part.input === "string") return part.input;
    if (typeof part.output === "string") return part.output;
  }
  return "";
}

function eventLogText(event) {
  if (event.type === "tool") {
    const title = event.payload?.title || event.payload?.kind || event.payload?.id || "工具调用";
    const status = event.payload?.status ? `：${event.payload.status}` : "";
    const content = contentPartText(event.payload?.content);
    return [title, status, content ? `\n${content}` : ""].join("").trim();
  }
  if (event.type === "plan") {
    const entries = event.payload?.entries;
    if (!Array.isArray(entries) || !entries.length) return "运行时更新了执行计划。";
    const lines = entries.map((entry, index) => {
      const title = entry.title || entry.content || entry.task || entry.description || `步骤 ${index + 1}`;
      const status = entry.status || entry.state || "";
      return `${status ? `[${status}] ` : ""}${title}`;
    });
    return ["运行时更新了执行计划：", ...lines].join("\n");
  }
  if (event.type === "usage") {
    const input = event.payload?.inputTokens ?? event.payload?.input_tokens ?? event.payload?.promptTokens;
    const output = event.payload?.outputTokens ?? event.payload?.output_tokens ?? event.payload?.completionTokens;
    const total = event.payload?.totalTokens ?? event.payload?.total_tokens;
    const parts = [
      input != null ? `输入 ${input}` : "",
      output != null ? `输出 ${output}` : "",
      total != null ? `总计 ${total}` : "",
    ].filter(Boolean);
    return parts.length ? `用量更新：${parts.join(" · ")}` : "";
  }
  return "";
}

function createSession(firstTask) {
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  if (!agent || !provider) return null;

  const hermesProfile = hermesProfileMetaFromAgent(agent);
  sessionSeq += 1;
  const session = {
    id: `session-${Date.now()}-${sessionSeq}`,
    providerId: provider.id,
    providerName: provider.name,
    agentId: agent.id,
    agentName: `${provider.name} / ${agent.name}`,
    task: firstTask,
    state: 2,
    runtimeState: "live",
    turns: [],
    createdAt: new Date().toISOString(),
    fullscreen: false,
    profileName: hermesProfile?.profileName || null,
    profileAlias: hermesProfile?.profileAlias || null,
    profileExecutable: hermesProfile?.profileExecutable || null,
    profilePath: hermesProfile?.profilePath || null,
    profileModel: hermesProfile?.profileModel || null,
    gateway: hermesProfile?.gateway || null,
    skillCount: hermesProfile?.skillCount ?? null,
    hasSoul: hermesProfile?.hasSoul || false,
  };
  sessions = [session, ...sessions];
  markSessionActive(session.id);
  saveCurrentSession(session.id);
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
  renderWorkspace({ scrollSessionId: session.id });
  return turn;
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

  const sections = sessionSectionsFromEvents(events);
  const lastState = [...events].reverse().find((event) => typeof event.state === "number");
  const acpSessionEvent = [...events].reverse().find((event) => event.payload?.sessionId);

  turn.thoughts = sections.thoughts;
  turn.outputs = sections.outputs;
  turn.finalResponse = sections.finalResponse;
  turn.logs = sections.logs;
  turn.state = lastState ? lastState.state : turn.state;
  if (acpSessionEvent?.payload?.sessionId) session.acpSessionId = acpSessionEvent.payload.sessionId;
  session.task = turn.task;
  session.state = turn.state;
  session.activeTurnId = turn.id;
  renderWorkspace({ scrollSessionId: session.id });
  renderHistory();
  return turn;
}

function appendStreamEventToTurn(sessionId, event) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const turn = session.turns.find((item) => item.id === session.activeTurnId) || session.turns.at(-1);
  if (!turn) return;

  const content = eventContentText(event);
  if (typeof event.state === "number") {
    turn.state = event.state;
    session.state = event.state;
  }

  if (event.payload?.sessionId) {
    session.acpSessionId = event.payload.sessionId;
  }

  switch (event.type) {
    case "thought":
      if (content) {
        if (!turn.thoughts.length) turn.thoughts.push(content);
        else turn.thoughts[turn.thoughts.length - 1] += content;
      }
      break;
    case "response":
      if (content) {
        if (!turn.outputs.length) turn.outputs.push(content);
        else turn.outputs[turn.outputs.length - 1] += content;
        turn.finalResponse = turn.outputs.join("");
      }
      break;
    case "tool":
      turn.logs = [
        content || `${event.payload?.title || event.payload?.kind || "tool"} ${event.payload?.status || ""}`.trim(),
        ...turn.logs,
      ];
      break;
    case "plan":
      turn.logs = [content || "计划已更新。", ...turn.logs];
      break;
    case "usage":
      if (content) turn.logs = [content, ...turn.logs];
      break;
    case "state":
      if (content) turn.logs = [content, ...turn.logs];
      break;
    default:
      if (content) turn.logs = [content, ...turn.logs];
      break;
  }

  renderWorkspace({ scrollSessionId: session.id });
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
    session.runtimeState = "resume_failed";
    markSessionInactive(session.id);
  }
  renderWorkspace();
  renderHistory();
  setAppNotice(`会话 ${session.agentName} 执行失败：${message}`, "error");
}

function renderWorkspaceStatus() {
  const agent = currentTargetAgent();
  const provider = currentTargetProvider();
  const liveCount = sessions.filter((session) => sessionRuntimeState(session) === "live").length;
  const liveSuffix = liveCount > 0 ? `　·　运行中 ACP runtime：${liveCount}` : "";
  if (!agent || !provider) {
    workspaceStatus.textContent = `请先设置当前发送目标。${liveSuffix}`;
    return;
  }
  workspaceStatus.textContent = `当前发送目标：${provider.name} / ${agent.name}${liveSuffix}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeLinkHref(value) {
  const href = String(value || "").trim();
  if (!/^(https?:|mailto:|file:)/i.test(href)) return "";
  return escapeHtml(href);
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeHref = safeLinkHref(href);
      return safeHref ? `<a href="${safeHref}" target="_blank" rel="noreferrer">${label}</a>` : label;
    });
}

function isMarkdownTable(lines, index) {
  return lines[index]?.trim().startsWith("|")
    && lines[index + 1]?.trim().startsWith("|")
    && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1].trim());
}

function renderMarkdownTable(lines) {
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  const header = cells(lines[0]);
  const alignments = cells(lines[1]).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
  const rows = lines.slice(2).map(cells);
  const alignAttr = (index) => ` style="text-align: ${alignments[index] || "left"}"`;
  return `
    <div class="md-table-wrap">
      <table class="md-table">
        <thead><tr>${header.map((cell, index) => `<th${alignAttr(index)}>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td${alignAttr(index)}>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderRichText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let orderedItems = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => {
      const task = /^\[( |x|X)\]\s+(.+)$/.exec(item);
      if (!task) return `<li>${renderInlineMarkdown(item)}</li>`;
      return `<li class="md-task-item"><span class="md-task-box ${task[1].toLowerCase() === "x" ? "is-checked" : ""}">${task[1].toLowerCase() === "x" ? "✓" : ""}</span>${renderInlineMarkdown(task[2])}</li>`;
    }).join("")}</ul>`);
    listItems = [];
  };
  const flushOrderedList = () => {
    if (!orderedItems.length) return;
    blocks.push(`<ol>${orderedItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
    orderedItems = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const lang = trimmed.slice(3).trim();
      index += 1;
      const code = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`
        <div class="md-code-block">
          <div class="md-code-toolbar">
            ${lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : "<span></span>"}
            <button type="button" class="mini-btn ghost-btn md-code-copy-btn">复制代码</button>
          </div>
          <pre class="md-code"><code>${escapeHtml(code.join("\n"))}</code></pre>
        </div>
      `);
      continue;
    }

    if (isMarkdownTable(lines, index)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const tableLines = [lines[index], lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderMarkdownTable(tableLines));
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const level = Math.min(heading[1].length + 2, 6);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      blocks.push("<hr>");
      index += 1;
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const quoteLines = [quote[1]];
      index += 1;
      while (index < lines.length) {
        const nextQuote = /^>\s?(.+)$/.exec(lines[index].trim());
        if (!nextQuote) break;
        quoteLines.push(nextQuote[1]);
        index += 1;
      }
      blocks.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join("<br>")}</blockquote>`);
      continue;
    }

    const list = /^[-*]\s+(.+)$/.exec(trimmed);
    if (list) {
      flushParagraph();
      flushOrderedList();
      listItems.push(list[1]);
      index += 1;
      continue;
    }

    const orderedList = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (orderedList) {
      flushParagraph();
      flushList();
      orderedItems.push(orderedList[1]);
      index += 1;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushOrderedList();
      index += 1;
      continue;
    }

    flushList();
    flushOrderedList();
    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  return blocks.join("");
}

function sessionCardStats(session) {
  const turnCount = session.turns.length;
  const thoughtCount = session.turns.reduce((count, turn) => count + turn.thoughts.length, 0);
  const logCount = session.turns.reduce((count, turn) => count + turn.logs.length, 0);
  const outputCount = session.turns.filter((turn) => turnResponseText(turn)).length;
  return [
    `轮次 ${turnCount}`,
    thoughtCount ? `思考 ${thoughtCount}` : "",
    logCount ? `运行 ${logCount}` : "",
    outputCount ? `响应 ${outputCount}` : "",
  ].filter(Boolean);
}

function isSessionLatestOnly(session) {
  return sessionLatestOnlyState.get(session.id) ?? false;
}

function toggleSessionLatestOnly(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  sessionLatestOnlyState.set(sessionId, !isSessionLatestOnly(session));
  renderWorkspace({ scrollSessionId: sessionId });
}

function turnResponseText(turn) {
  return turn.finalResponse || turn.outputs.join("\n\n");
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
  const waiting = turn.state === 2 && !turn.finalResponse;
  const rawResponseText = turnResponseText(turn);
  const responseText = rawResponseText || "等待响应...";
  const thoughtDetailKey = `${turn.id}:thoughts`;
  const logDetailKey = `${turn.id}:logs`;
  return `
    <section class="turn-block">
      <div class="turn-header">
        <strong>第 ${index + 1} 轮</strong>
        <div class="turn-header-actions">
          <span class="state-pill ${stateClasses[turn.state] || "state-idle"}">${stateNames[turn.state] || "UNKNOWN"}</span>
          <button type="button" class="mini-btn ghost-btn turn-copy-btn" data-turn-id="${escapeHtml(turn.id)}">复制本轮</button>
          <button type="button" class="mini-btn ghost-btn turn-copy-response-btn" data-turn-id="${escapeHtml(turn.id)}" ${rawResponseText ? "" : "disabled"}>复制响应</button>
        </div>
      </div>
      <div class="terminal-message user-message">
        <div class="terminal-label">user</div>
        <p>${escapeHtml(turn.task)}</p>
      </div>
      ${turn.thoughts.length
        ? `
          <details class="terminal-detail" data-detail-key="${escapeHtml(thoughtDetailKey)}" ${detailOpenAttribute(thoughtDetailKey, waiting)}>
            <summary>思考流 · ${turn.thoughts.length}</summary>
            <div class="terminal-pre rich-text">${renderRichText(turn.thoughts.join("\n\n"))}</div>
          </details>
        `
        : ""}
      <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
        <div class="terminal-label">assistant</div>
        <div class="rich-text">${renderRichText(responseText)}</div>
      </div>
      ${turn.logs.length
        ? `
          <details class="terminal-detail log-block" data-detail-key="${escapeHtml(logDetailKey)}" ${detailOpenAttribute(logDetailKey, waiting)}>
            <summary>运行流 · ${turn.logs.length}</summary>
            <div class="terminal-pre rich-text">${renderRichText(turn.logs.join("\n"))}</div>
          </details>
        `
        : ""}
    </section>
  `;
}

function renderSessionCard(session) {
  const runtimeState = sessionRuntimeState(session);
  const isActiveReceiver = currentSessionId === session.id;
  const isWaiting = isSessionExecuting(session);
  const canDismiss = runtimeState !== "restoring";
  const profileMeta = session.providerId === "hermes"
    ? [session.profileName, session.profileModel].filter(Boolean).join(" · ")
    : "";
  const stats = sessionCardStats(session);
  const latestOnly = isSessionLatestOnly(session);
  const hasFlowDetails = flowDetailEntriesForSession(session).length > 0;
  const flowsOpen = areSessionFlowDetailsOpen(session);
  const turnEntries = session.turns.map((turn, index) => ({ turn, index }));
  const visibleTurnEntries = latestOnly && turnEntries.length > 1 ? turnEntries.slice(-1) : turnEntries;
  const hiddenTurnCount = turnEntries.length - visibleTurnEntries.length;
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}" tabindex="0" aria-label="切换到会话：${escapeHtml(session.task)}" ${isActiveReceiver ? "aria-current=\"true\"" : ""}>
      ${isActiveReceiver ? `<div class="active-receiver-banner">当前会话</div>` : ""}
      <div class="session-card-header">
        <div class="session-card-meta">
          <div class="session-card-title-row">
            <strong>${escapeHtml(session.agentName)}</strong>
          </div>
          ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
          <div class="caption session-task">${escapeHtml(session.task)}</div>
          <div class="session-card-stats">
            ${stats.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </div>
        <div class="session-card-actions">
          <div class="session-card-runtime">
            <span class="runtime-pill ${runtimeStateClasses[runtimeState] || "runtime-archived"} ${isWaiting ? "is-busy" : ""}" aria-label="会话状态：${runtimeStateLabels[runtimeState] || runtimeState}">${runtimeStateLabels[runtimeState] || runtimeState}</span>
          </div>
          ${canDismiss ? `<button type="button" class="mini-btn ghost-btn session-dismiss-btn" data-session-id="${session.id}" title="退出工作台" aria-label="退出工作台">⏏</button>` : ""}
          ${canDismiss && !isWaiting ? `<button type="button" class="mini-btn ghost-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="删除会话" aria-label="删除会话">🗑</button>` : ""}
          ${canRestoreSession(session) ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">重试恢复</button>` : ""}
          <div class="session-tool-group" role="group" aria-label="会话操作">
            <button type="button" class="mini-btn ghost-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="复制会话" aria-label="复制会话" ${session.turns.length ? "" : "disabled"}>⧉</button>
            <button type="button" class="mini-btn ghost-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnly ? "显示全部轮次" : "只看最新轮次"}" aria-label="${latestOnly ? "显示全部轮次" : "只看最新轮次"}" ${session.turns.length > 1 ? "" : "disabled"}>${latestOnly ? "☰" : "◉"}</button>
            <button type="button" class="mini-btn ghost-btn tool-btn session-toggle-flows-btn ${flowsOpen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${flowsOpen ? "true" : "false"}" title="${flowsOpen ? "折叠过程流" : "展开过程流"}" aria-label="${flowsOpen ? "折叠过程流" : "展开过程流"}" ${hasFlowDetails ? "" : "disabled"}>${flowsOpen ? "▴" : "▾"}</button>
            <button type="button" class="mini-btn ghost-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="滚动到最新" aria-label="滚动到最新">↓</button>
            <button type="button" class="mini-btn ghost-btn tool-btn session-fullscreen-btn ${session.fullscreen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${session.fullscreen ? "true" : "false"}" title="${session.fullscreen ? "退出全屏阅读" : "进入全屏阅读"}" aria-label="${session.fullscreen ? "退出全屏阅读" : "进入全屏阅读"}">
              ${session.fullscreen ? "⤢" : "⛶"}
            </button>
          </div>
        </div>
      </div>
      <div class="session-card-body">
        ${session.turns.length
          ? `${hiddenTurnCount ? `<div class="session-hidden-turns">已隐藏前 ${hiddenTurnCount} 轮，复制会话仍包含完整 transcript。</div>` : ""}${visibleTurnEntries.map(({ turn, index }) => renderTurn(turn, index)).join("")}<div class="session-latest-anchor">${isWaiting ? "streaming..." : "latest"}</div>`
          : "<p class='flow-empty'>当前会话尚未产生消息。</p>"}
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
  sessionDeck.querySelectorAll(".session-delete-btn").forEach((button) => {
    button.addEventListener("click", () => deleteSession(button.dataset.sessionId));
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
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${button.dataset.sessionId}"] .session-card-body`);
      if (body) body.scrollTop = body.scrollHeight;
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
  sessionDeck.querySelectorAll(".session-toggle-flows-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const session = sessions.find((item) => item.id === button.dataset.sessionId);
      if (!session) return;
      const shouldOpen = !areSessionFlowDetailsOpen(session);
      setSessionFlowDetails(session.id, shouldOpen);
      setAppNotice(shouldOpen ? "已展开当前会话的思考流与运行流。" : "已折叠当前会话的思考流与运行流。");
    });
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
      const code = button.closest(".md-code-block")?.querySelector("code")?.textContent || "";
      if (!code) {
        setAppNotice("当前代码块为空。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(code);
      setAppNotice(copied ? "已复制代码块。" : "复制失败，请手动选择代码。", copied ? "muted" : "error");
    });
  });
}

function activateWorkspaceSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  saveCurrentTargetAgent(session.agentId);
  saveCurrentSession(session.id);
  if (canSendToSession(session)) markSessionActive(session.id);
  renderProviders();
  renderWorkspace();
  setAppNotice(canSendToSession(session)
    ? `当前工作 session 已切换到：${session.task}`
    : "已切换到只读会话；继续发送会创建新的 live 会话或需要先恢复。");
}

async function archiveLiveSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const commands = acpCommandsForProvider(session.providerId);
  try {
    if (commands) await invoke(commands.shutdown, { runtimeSessionId: session.id });
  } catch (error) {
    console.error(error);
  }
  session.runtimeState = "archived";
  markSessionInactive(session.id);
  clearCurrentSessionIf(session.id);
  renderWorkspace();
  renderHistory();
  setAppNotice(`${session.agentName} 已归档，ACP runtime 已释放。`);
}

function removeSessionFromWorkspace(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  sessions = sessions.filter((item) => item.id !== sessionId);
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
    await archiveLiveSession(sessionId);
  }
  const removed = removeSessionFromWorkspace(sessionId);
  if (!removed) return;
  renderWorkspace();
  renderHistory();
  setAppNotice(`${removed.agentName} 已退出工作台，历史保留在右侧归档。`);
}

async function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(historyEntries).find((item) => item.id === sessionId);
  const runtimeState = session ? sessionRuntimeState(session) : archived?.runtimeState || "archived";
  const title = session?.task || archived?.title || "该会话";
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，暂不支持删除。", "busy");
    return;
  }
  if (session && isSessionExecuting(session)) {
    setAppNotice("该会话正在执行中，请等待完成后再删除。", "busy");
    return;
  }
  if (!session && !archived) return;
  const confirmed = window.confirm(`删除「${title}」？\n\n这会从工作台和历史归档中移除该 session 的所有轮次。`);
  if (!confirmed) return;
  const doubleConfirmed = window.confirm(`再次确认删除「${title}」？\n\n删除后不能从 LunaAgentOS 本地历史恢复。`);
  if (!doubleConfirmed) return;
  try {
    if (session && runtimeState === "live") {
      await archiveLiveSession(sessionId);
    }
    removeSessionFromWorkspace(sessionId);
    const result = await invoke("delete_history_session_entries", { sessionId });
    historyEntries = historyEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    renderWorkspace();
    renderHistory();
    const skipped = result?.skippedFiles ? `，跳过损坏文件 ${result.skippedFiles} 个` : "";
    setAppNotice(`已删除会话，移除历史轮次 ${result?.removedCount || 0} 条${skipped}。`);
  } catch (error) {
    console.error(error);
    setAppNotice(`删除会话失败：${formatBackendError(error)}`, "error");
  }
}

function renderWorkspace(options = {}) {
  const scrollSessionId = options.scrollSessionId || null;
  const activeBodies = [...sessionDeck.querySelectorAll(".session-card-body")].map((body) => ({
    sessionId: body.closest(".session-card")?.dataset.sessionId,
    shouldStickToBottom: body.scrollTop + body.clientHeight >= body.scrollHeight - 24,
  }));
  const visibleSessions = [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  renderWorkspaceStatus();
  workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
  sessionDeck.classList.toggle("is-single-session", visibleSessions.length === 1);
  sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
  bindSessionActions();
  requestAnimationFrame(() => {
    const activeCard = currentSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${currentSessionId}"]`)
      : null;
    activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    const scrollBody = scrollSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${scrollSessionId}"] .session-card-body`)
      : null;
    if (scrollBody) scrollBody.scrollTop = scrollBody.scrollHeight;
    if (!activeBodies.length) {
      sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
        body.scrollTop = body.scrollHeight;
      });
      return;
    }
    activeBodies.forEach(({ sessionId, shouldStickToBottom }) => {
      if (sessionId === scrollSessionId) return;
      if (!shouldStickToBottom) return;
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
      if (body) body.scrollTop = body.scrollHeight;
    });
  });
}

function groupHistory(entries) {
  return entries.reduce((groups, entry) => {
    if (!groups[entry.date]) groups[entry.date] = [];
    groups[entry.date].push(entry);
    return groups;
  }, {});
}

function historySessionKey(entry) {
  return entry.session_id || entry.acp_session_id || entry.id;
}

function historyTurnKey(entry) {
  return `${historySessionKey(entry)}:${entry.turn?.id || entry.id}`;
}

function archivedSessionsFromHistory(entries) {
  const bySession = new Map();
  entries.forEach((entry) => {
    const key = historySessionKey(entry);
    const turn = entry.turn || {
      id: entry.id,
      task: entry.task,
      state: 5,
      thoughts: [],
      outputs: [],
      finalResponse: entry.summary,
      logs: ["由历史归档恢复，当前不是运行中的 runtime session。"],
      createdAt: entry.created_at,
    };
    const current = bySession.get(key);
    const hermesProfile = entry.turn?.meta?.hermesProfile || null;
    if (!current) {
      bySession.set(key, {
        id: key,
        date: entry.date,
        createdAt: entry.created_at,
        updatedAt: entry.created_at,
        providerId: entry.provider_id,
        providerName: entry.provider_name,
        agentId: entry.agent_id,
        agentName: entry.agent_name,
        acpSessionId: entry.acp_session_id,
        title: entry.task,
        summary: entry.summary,
        turnCount: 1,
        turns: [turn],
        runtimeState: "archived",
        hermesProfile,
      });
      return;
    }
    current.updatedAt = current.updatedAt > entry.created_at ? current.updatedAt : entry.created_at;
    current.summary = entry.summary || current.summary;
    current.turnCount += 1;
    current.turns.push(turn);
    current.hermesProfile = current.hermesProfile || hermesProfile;
  });
  return [...bySession.values()]
    .map((session) => ({
      ...session,
      turns: session.turns.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sessionListItems() {
  const liveItems = sessions.map((session) => {
    const lastTurn = session.turns.at(-1);
    return {
      id: session.id,
      date: session.createdAt.slice(0, 10),
      createdAt: session.createdAt,
      updatedAt: lastTurn?.createdAt || session.createdAt,
      providerName: session.providerName,
      agentName: session.agentName,
      title: session.task || "新会话",
      summary: lastTurn?.finalResponse || lastTurn?.outputs.at(-1) || lastTurn?.logs.at(-1) || "当前会话",
      turnCount: session.turns.length,
      runtimeState: sessionRuntimeState(session),
      agentId: session.agentId,
    };
  });
  const liveIds = new Set(liveItems.map((item) => item.id));
  const archivedItems = archivedSessionsFromHistory(historyEntries).filter((item) => !liveIds.has(item.id));
  return [...liveItems, ...archivedItems].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function renderHistory() {
  if (isHistoryLoading) {
    historyList.innerHTML = `
      <div class="history-empty">
        <strong>会话列表加载中</strong>
        <p>首屏先起工作台，会话归档会在后台补齐。</p>
      </div>
    `;
    return;
  }

  const sessionItems = sessionListItems();
  if (!sessionItems.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <strong>暂无会话</strong>
        <p>第一次发送后，这里会记录 Agent 会话，而不是每条对话详情。</p>
      </div>
    `;
    return;
  }

  const groups = groupHistory(sessionItems.map((item) => ({
    ...item,
    date: item.date || item.updatedAt.slice(0, 10),
  })));
  const dates = Object.keys(groups).sort((left, right) => right.localeCompare(left));

  historyList.innerHTML = dates.map((date) => `
    <section class="history-group">
      <div class="history-date">${date}</div>
      <div class="history-group-list">
        ${groups[date].map((item) => {
          const isActiveHistoryItem = currentSessionId === item.id;
          return `
          <article class="history-item ${item.runtimeState === "live" ? "is-live" : "is-archive"} ${isActiveHistoryItem ? "is-active-session" : ""}" data-session-id="${item.id}" data-agent-id="${item.agentId || ""}">
            <div class="history-item-top">
              <strong>${item.providerName}</strong>
              <div class="history-item-actions">
                <span>${formatTime(item.updatedAt)}</span>
                <button type="button" class="history-delete-btn" data-session-id="${item.id}" title="删除会话" aria-label="删除会话">🗑</button>
              </div>
            </div>
            <div class="caption">${item.agentName} · ${item.turnCount} 轮 · ${runtimeStateLabels[item.runtimeState] || item.runtimeState}</div>
            <p>${item.title}</p>
            <p class="caption">${item.summary}</p>
          </article>
        `;
        }).join("")}
      </div>
    </section>
  `).join("");
  bindSessionListActions();
}

function bindSessionListActions() {
  historyList.querySelectorAll(".history-delete-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSession(button.dataset.sessionId);
    });
  });
  historyList.querySelectorAll(".history-item.is-live").forEach((item) => {
    item.addEventListener("click", () => {
      const agentId = item.dataset.agentId;
      const sessionId = item.dataset.sessionId;
      const session = sessions.find((entry) => entry.id === sessionId);
      if (!session || !canSendToSession(session)) {
        setAppNotice("该 session 当前不可续聊，请先重连。", "error");
        return;
      }
      if (agentId) saveCurrentTargetAgent(agentId);
      if (sessionId) {
        saveCurrentSession(sessionId);
        markSessionActive(sessionId);
      }
      renderProviders();
      renderWorkspace();
      setAppNotice("已切换到当前会话。");
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
    };
    provider.agents.push(agent);
  }
  if (provider.id === "hermes") {
    const hermesProfile = hermesProfileMetaFromArchived(archived);
    const liveAgent = provider.agents.find((entry) =>
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
  const archived = archivedSessionsFromHistory(historyEntries).find((item) => item.id === sessionId);
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
    task: archived.title,
    state: 5,
    turns: archived.turns,
    createdAt: archived.createdAt,
    fullscreen: false,
    acpSessionId: archived.acpSessionId,
    runtimeState: "archived",
    profileName: archived.hermesProfile?.profileName || null,
    profileAlias: archived.hermesProfile?.profileAlias || null,
    profileExecutable: archived.hermesProfile?.profileExecutable || null,
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
  if (!existing) sessions = [restored, ...sessions];
  saveCurrentTargetAgent(restored.agentId);
  saveCurrentSession(restored.id);
  renderProviders();
  renderWorkspace();
  renderHistory();
  if (!restored.acpSessionId) {
    restored.runtimeState = "archived";
    renderWorkspace();
    renderHistory();
    setAppNotice("已从历史归档恢复会话。缺少 ACP sessionId，当前为只读 transcript。");
    return;
  }
  restored.runtimeState = "restoring";
  renderWorkspace();
  renderHistory();
  setAppNotice("已恢复历史 transcript，正在尝试加载 ACP runtime...", "busy");
  const commands = acpCommandsForProvider(restored.providerId);
  if (!commands) {
    restored.runtimeState = "archived";
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
      profileExecutable: restored.profileExecutable || null,
    });
    restored.runtimeState = "live";
    markSessionActive(restored.id);
    saveCurrentSession(restored.id);
    renderWorkspace();
    renderHistory();
    setAppNotice("历史 session 已重连为可续聊的 ACP runtime。");
  } catch (loadError) {
    try {
      await invoke(commands.resume, {
        runtimeSessionId: restored.id,
        acpSessionId: restored.acpSessionId,
        cwd: null,
        profileExecutable: restored.profileExecutable || null,
      });
      restored.runtimeState = "live";
      markSessionActive(restored.id);
      saveCurrentSession(restored.id);
      renderWorkspace();
      renderHistory();
      setAppNotice("ACP load 失败，已通过 resume 重连为可续聊的 runtime。");
    } catch (resumeError) {
      restored.runtimeState = "resume_failed";
      markSessionInactive(restored.id);
      saveCurrentSession(restored.id);
      renderWorkspace();
      renderHistory();
      setAppNotice(`ACP runtime 重连失败，保留只读 transcript：${formatBackendError(resumeError || loadError)}`, "error");
    }
  }
}

async function loadHistory() {
  try {
    const compactResult = await invoke("compact_history_entries");
    historyEntries = await invoke("load_history_entries");
    const removedCount = compactResult?.removedCount || 0;
    const upgradedCount = compactResult?.upgradedCount || 0;
    const skippedFiles = compactResult?.skippedFiles || 0;
    if (removedCount > 0 || upgradedCount > 0 || skippedFiles > 0) {
      setAppNotice(`历史记录已整理：去重 ${removedCount} 条，升级 ${upgradedCount} 条，跳过损坏文件 ${skippedFiles} 个。`, skippedFiles > 0 ? "error" : "info");
    }
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
  const hermesProfile = hermesProfileMetaFromSession(session);
  const turnForHistory = {
    ...turn,
    meta: hermesProfile ? { ...(turn.meta || {}), hermesProfile } : turn.meta,
  };
  const entry = await invoke("append_history_entry", {
    entry: {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      providerId: session.providerId,
      providerName: session.providerName,
      agentId: session.agentId,
      agentName: session.agentName,
      sessionId: session.id,
      acpSessionId: session.acpSessionId || null,
      task: turn.task,
      status: stateNames[turn.state] || "UNKNOWN",
      summary: turn.finalResponse || turn.outputs.at(-1) || turn.logs.at(0) || "消息已结束。",
      turn: turnForHistory,
    },
  });
  const key = historyTurnKey(entry);
  const existingIndex = historyEntries.findIndex((item) => historyTurnKey(item) === key);
  if (existingIndex >= 0) {
    historyEntries = historyEntries.map((item, index) => (index === existingIndex ? entry : item));
  } else {
    historyEntries = [entry, ...historyEntries];
  }
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
    turn.logs = [
      `Hermes profile ${session.profileName || session.agentName} 正在启动 ACP 运行时，首次响应可能较慢。`,
      ...turn.logs,
    ];
    renderWorkspace({ scrollSessionId: session.id });
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    const saved = updateTurnFromEvents(session.id, turn.id, fallback.events);
    if (saved) {
      await saveTurnToHistory(session, saved);
      setAppNotice(`${session.agentName} 会话已完成并写入历史。`);
    }
  } catch (error) {
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
    turn.logs = [
      `Hermes profile ${session.profileName || session.agentName} 正在启动 ACP 运行时，首次响应可能较慢。`,
      ...turn.logs,
    ];
    renderWorkspace({ scrollSessionId: session.id });
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke(commands.prompt, {
      runtimeSessionId: session.id,
      prompt: turn.task,
      cwd: null,
      profileExecutable: session.profileExecutable || null,
    });
    const saved = updateTurnFromEvents(session.id, turn.id, events);
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
    setAppNotice("请先在左侧设定当前发送目标，再发送任务。", "error");
    return;
  }

  const session = getOrCreateActiveSession(task, forceNewSession);
  if (!session) return;
  const turn = createTurn(session, task);
  promptBox.value = "";
  sendAsNewSession = false;
  updateActionLabels();

  const commands = acpCommandsForProvider(provider.id);
  if (commands) {
    void startAcpSession(session, turn);
    return;
  }

  void startFallbackSession(session, turn, provider.id);
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
applyFontScale();
updateSendModeLabel();
renderWorkspace();
renderHistory();
updateActionLabels();
setTimeout(() => {
  void loadHistory();
}, 0);
setTimeout(() => {
  void loadHermesProfiles();
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
        session.runtimeState = "resume_failed";
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
