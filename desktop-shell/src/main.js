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
  live: "可继续",
  archived: "只读归档",
  restoring: "恢复中",
  resume_failed: "恢复失败",
};

const runtimeStateClasses = {
  live: "runtime-live",
  archived: "runtime-archived",
  restoring: "runtime-restoring",
  resume_failed: "runtime-failed",
};

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

const MAIN_AGENT_KEY = "lunaagentos.mainAgentId";
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

let mainAgentId = localStorage.getItem(MAIN_AGENT_KEY) || "claude-main";
let sessions = [];
let activeSessionIds = {};
let historyEntries = [];
let sessionSeq = 0;
let turnSeq = 0;
let customAgentSeq = 0;
let runningSessions = 0;
let isHistoryLoading = true;
let sendAsNewSession = false;
let sendMode = localStorage.getItem(SEND_MODE_KEY) || "enter";
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";

function allAgents() {
  return providers.flatMap((provider) => provider.agents);
}

function providerById(id) {
  return providers.find((provider) => provider.id === id);
}

function ensureMainAgentExists() {
  if (agentById(mainAgentId)) return;
  if (agentById(DEFAULT_HERMES_AGENT_ID)) {
    saveMainAgent(DEFAULT_HERMES_AGENT_ID);
    return;
  }
  if (agentById("claude-main")) {
    saveMainAgent("claude-main");
    return;
  }
  const fallbackAgent = allAgents()[0];
  if (fallbackAgent) saveMainAgent(fallbackAgent.id);
}

function agentById(id) {
  return allAgents().find((agent) => agent.id === id);
}

function providerForAgent(agentId) {
  const agent = agentById(agentId);
  return agent ? providerById(agent.providerId) : null;
}

function currentMainAgent() {
  return agentById(mainAgentId);
}

function currentMainProvider() {
  return providerForAgent(mainAgentId);
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

function saveMainAgent(agentId) {
  mainAgentId = agentId;
  localStorage.setItem(MAIN_AGENT_KEY, agentId);
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
  sendModeBtn.textContent = sendMode === "enter" ? "回车发送" : "Ctrl+回车";
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

function createAgentForProvider(providerId) {
  const provider = providerById(providerId);
  if (!provider) return;
  customAgentSeq += 1;
  const agent = {
    id: `${provider.id}-custom-${Date.now()}-${customAgentSeq}`,
    providerId: provider.id,
    name: `会话 ${provider.agents.length + 1}`,
    subtitle: "独立 RuntimeSession",
    note: "新建 Agent 不继承其他 Agent 的当前会话；历史任务只作为归档展示。",
    state: 1,
  };
  provider.agents.push(agent);
  saveMainAgent(agent.id);
  delete activeSessionIds[agent.id];
  renderProviders();
  renderWorkspace();
  setAppNotice(`已新建 ${provider.name} / ${agent.name}，下一条消息会开启全新的运行时会话。`);
}

function setMainAgent(agentId) {
  saveMainAgent(agentId);
  const agent = currentMainAgent();
  const provider = currentMainProvider();
  if (agent && provider) {
    workspaceStatus.textContent = `当前发送目标：${provider.name} / ${agent.name}`;
    setAppNotice(`当前发送目标已切换到 ${provider.name} / ${agent.name}。`);
  }
  renderProviders();
  renderWorkspace();
}

function renderProviders() {
  ensureMainAgentExists();
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
          <div class="agent-entry ${agent.id === mainAgentId ? "is-main-agent" : "is-selectable"}" data-agent-id="${agent.id}">
            <div class="agent-entry-top">
              <strong>${agent.name}</strong>
            </div>
            <div class="agent-entry-sub">${agent.subtitle}</div>
            ${agent.id === mainAgentId
              ? ""
              : `<div class="agent-entry-actions"><span class="agent-action-hint">设为主入口</span></div>`}
          </div>
        `).join("")}
      </div>
      <button type="button" class="mini-btn add-agent-btn" data-provider-id="${provider.id}">+ 新增 Agent</button>
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
      setMainAgent(agentId);
    });
  });

  agentList.querySelectorAll(".add-agent-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const providerId = button.dataset.providerId;
      createAgentForProvider(providerId);
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
    path: profile.path,
    skillCount: profile.skillCount,
    hasEnv: profile.hasEnv,
    hasSoul: profile.hasSoul,
    isDefault: Boolean(profile.isDefault),
  }));
  hermesProvider.note = `已载入 ${profiles.length} 个 Hermes profile。`;
  ensureMainAgentExists();
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
      .map((item) => typeof item === "string" ? item : item?.text || item?.content || "")
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "object") {
    return content.text || content.content || eventLogText(event);
  }
  return String(content);
}

function eventLogText(event) {
  if (event.type === "tool") {
    const title = event.payload?.title || event.payload?.kind || event.payload?.id || "工具调用";
    const status = event.payload?.status ? `：${event.payload.status}` : "";
    return `${title}${status}`;
  }
  if (event.type === "plan") return "Claude 更新了执行计划。";
  if (event.type === "usage") return "";
  return "";
}

function createSession(firstTask) {
  const agent = currentMainAgent();
  const provider = currentMainProvider();
  if (!agent || !provider) return null;

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
    profileName: agent.profileName || null,
    profileCommand: agent.alias || null,
  };
  sessions = [session, ...sessions];
  activeSessionIds[agent.id] = session.id;
  renderWorkspace();
  renderHistory();
  return session;
}

function createTurn(session, task) {
  turnSeq += 1;
  const turn = {
    id: `turn-${Date.now()}-${turnSeq}`,
    task,
    state: 0,
    thoughts: [],
    outputs: [],
    finalResponse: "正在等待运行时返回内容...",
    logs: ["消息已进入当前会话，等待运行时返回内容。"],
    createdAt: new Date().toISOString(),
  };
  session.task = task;
  session.state = 2;
  session.activeTurnId = turn.id;
  session.turns.push(turn);
  renderWorkspace();
  return turn;
}

function getOrCreateActiveSession(task, forceNew = false) {
  const agent = currentMainAgent();
  if (!agent) return null;
  const activeSessionId = activeSessionIds[agent.id];
  const existing = !forceNew ? sessions.find((item) => item.id === activeSessionId) : null;
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
  renderWorkspace();
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
        `${event.payload?.title || event.payload?.kind || "tool"} ${event.payload?.status || ""}`.trim(),
        ...turn.logs,
      ];
      break;
    case "plan":
      turn.logs = ["计划已更新。", ...turn.logs];
      break;
    case "state":
      if (content) turn.logs = [content, ...turn.logs];
      break;
    default:
      if (content) turn.logs = [content, ...turn.logs];
      break;
  }

  renderWorkspace();
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
    if (activeSessionIds[session.agentId] === session.id) {
      delete activeSessionIds[session.agentId];
    }
  }
  renderWorkspace();
  renderHistory();
  setAppNotice(`会话 ${session.agentName} 执行失败：${message}`, "error");
}

function renderWorkspaceStatus() {
  const agent = currentMainAgent();
  const provider = currentMainProvider();
  const liveCount = sessions.filter((session) => sessionRuntimeState(session) === "live").length;
  const liveSuffix = liveCount > 0 ? `　·　运行中 ACP runtime：${liveCount}` : "";
  if (!agent || !provider) {
    workspaceStatus.textContent = `请先设置当前发送目标。${liveSuffix}`;
    return;
  }
  workspaceStatus.textContent = `当前发送目标：${provider.name} / ${agent.name}${liveSuffix}`;
}

function renderTurn(turn, index) {
  const waiting = turn.state === 2 && !turn.finalResponse;
  return `
    <section class="turn-block">
      <div class="turn-header">
        <strong>第 ${index + 1} 轮</strong>
        <span class="state-pill ${stateClasses[turn.state] || "state-idle"}">${stateNames[turn.state] || "UNKNOWN"}</span>
      </div>
      <div class="terminal-message user-message">
        <div class="terminal-label">user</div>
        <p>${turn.task}</p>
      </div>
      ${turn.thoughts.length
        ? `
          <details class="terminal-detail">
            <summary>思考流</summary>
            <div class="terminal-pre">${turn.thoughts.join("\n\n")}</div>
          </details>
        `
        : ""}
      <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
        <div class="terminal-label">assistant</div>
        <p>${turn.finalResponse || turn.outputs.join("\n\n") || "等待响应..."}</p>
      </div>
      ${turn.logs.length
        ? `
          <details class="terminal-detail log-block">
            <summary>运行流</summary>
            <div class="terminal-pre">${turn.logs.join("\n")}</div>
          </details>
        `
        : ""}
    </section>
  `;
}

function renderSessionCard(session) {
  const runtimeState = sessionRuntimeState(session);
  const isActiveReceiver = activeSessionIds[session.agentId] === session.id && canSendToSession(session);
  const isWaiting = session.state === 2;
  const canDismiss = runtimeState !== "restoring";
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}">
      ${isActiveReceiver ? `<div class="active-receiver-banner">当前接收任务</div>` : ""}
      <div class="session-card-header">
        <div>
          <div class="session-card-title-row">
            <strong>${session.agentName}</strong>
            <span class="runtime-pill ${runtimeStateClasses[runtimeState] || "runtime-archived"}">${runtimeStateLabels[runtimeState] || runtimeState}</span>
          </div>
          <div class="caption session-task">${session.task}</div>
        </div>
        <div class="session-card-actions">
          ${canDismiss ? `<button type="button" class="mini-btn ghost-btn session-dismiss-btn" data-session-id="${session.id}">退出工作台</button>` : ""}
          ${canRestoreSession(session) ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">重试恢复</button>` : ""}
          <button type="button" class="mini-btn ghost-btn session-fullscreen-btn" data-session-id="${session.id}">
            ${session.fullscreen ? "退出全屏" : "全屏"}
          </button>
        </div>
      </div>
      <div class="session-card-body">
        ${session.turns.length
          ? session.turns.map(renderTurn).join("")
          : "<p class='flow-empty'>当前会话尚未产生消息。</p>"}
      </div>
    </article>
  `;
}

function bindSessionActions() {
  sessionDeck.querySelectorAll(".session-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
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
  sessionDeck.querySelectorAll(".session-retry-btn").forEach((button) => {
    button.addEventListener("click", () => restoreArchivedSession(button.dataset.sessionId));
  });
}

function activateWorkspaceSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  if (!canSendToSession(session)) {
    setAppNotice("该会话当前不是 live runtime，请先重试恢复后再继续发送。", "error");
    return;
  }
  saveMainAgent(session.agentId);
  activeSessionIds[session.agentId] = session.id;
  renderProviders();
  renderWorkspace();
  setAppNotice(`当前工作 session 已切换到：${session.task}`);
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
  if (activeSessionIds[session.agentId] === session.id) {
    delete activeSessionIds[session.agentId];
  }
  renderWorkspace();
  renderHistory();
  setAppNotice(`${session.agentName} 已归档，ACP runtime 已释放。`);
}

function removeSessionFromWorkspace(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  sessions = sessions.filter((item) => item.id !== sessionId);
  if (activeSessionIds[session.agentId] === session.id) {
    delete activeSessionIds[session.agentId];
    const fallbackLive = sessions.find((item) => item.agentId === session.agentId && canSendToSession(item));
    if (fallbackLive) activeSessionIds[session.agentId] = fallbackLive.id;
  }
  return session;
}

async function dismissWorkspaceSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const runtimeState = sessionRuntimeState(session);
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在恢复中，请稍后再退出工作台。", "busy");
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

function renderWorkspace() {
  const activeBodies = [...sessionDeck.querySelectorAll(".session-card-body")].map((body) => ({
    sessionId: body.closest(".session-card")?.dataset.sessionId,
    shouldStickToBottom: body.scrollTop + body.clientHeight >= body.scrollHeight - 24,
  }));
  const visibleSessions = [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const activeSessionId = activeSessionIds[mainAgentId];
  renderWorkspaceStatus();
  workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
  sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
  bindSessionActions();
  requestAnimationFrame(() => {
    const activeCard = activeSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${activeSessionId}"]`)
      : null;
    activeCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (!activeBodies.length) {
      sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
        body.scrollTop = body.scrollHeight;
      });
      return;
    }
    activeBodies.forEach(({ sessionId, shouldStickToBottom }) => {
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
      });
      return;
    }
    current.updatedAt = current.updatedAt > entry.created_at ? current.updatedAt : entry.created_at;
    current.summary = entry.summary || current.summary;
    current.turnCount += 1;
    current.turns.push(turn);
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
        ${groups[date].map((item) => `
          <article class="history-item ${item.runtimeState === "live" ? "is-live" : "is-archive"}" data-session-id="${item.id}" data-agent-id="${item.agentId || ""}">
            <div class="history-item-top">
              <strong>${item.providerName}</strong>
              <span>${formatTime(item.updatedAt)}</span>
            </div>
            <div class="caption">${item.agentName} · ${item.turnCount} 轮 · ${runtimeStateLabels[item.runtimeState] || item.runtimeState}</div>
            <p>${item.title}</p>
            <p class="caption">${item.summary}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
  bindSessionListActions();
}

function bindSessionListActions() {
  historyList.querySelectorAll(".history-item.is-live").forEach((item) => {
    item.addEventListener("click", () => {
      const agentId = item.dataset.agentId;
      const sessionId = item.dataset.sessionId;
      const session = sessions.find((entry) => entry.id === sessionId);
      if (!session || !canSendToSession(session)) {
        setAppNotice("该 session 当前不是可继续状态，请先恢复。", "error");
        return;
      }
      if (agentId) saveMainAgent(agentId);
      if (agentId && sessionId) activeSessionIds[agentId] = sessionId;
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
    const liveAgent = provider.agents.find((entry) => entry.id === archived.agentId);
    if (liveAgent) {
      agent.profileName = liveAgent.profileName || agent.profileName || null;
      agent.alias = liveAgent.alias || agent.alias || null;
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
    setAppNotice("该 session 正在恢复中，请稍等。", "busy");
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
    profileName: null,
    profileCommand: null,
  };
  const restoredAgent = ensureArchivedAgent(archived);
  restored.profileName = restored.profileName || restoredAgent.profileName || null;
  restored.profileCommand = restored.profileCommand || restoredAgent.alias || null;
  if (!existing) sessions = [restored, ...sessions];
  saveMainAgent(restored.agentId);
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
      profileCommand: restored.profileCommand || null,
    });
    restored.runtimeState = "live";
    activeSessionIds[restored.agentId] = restored.id;
    renderWorkspace();
    renderHistory();
    setAppNotice("历史 session 已加载为可继续对话的 ACP runtime。");
  } catch (loadError) {
    try {
      await invoke(commands.resume, {
        runtimeSessionId: restored.id,
        acpSessionId: restored.acpSessionId,
        cwd: null,
        profileCommand: restored.profileCommand || null,
      });
      restored.runtimeState = "live";
      activeSessionIds[restored.agentId] = restored.id;
      renderWorkspace();
      renderHistory();
      setAppNotice("ACP load 失败，已通过 resume 恢复为可继续对话的 runtime。");
    } catch (resumeError) {
      restored.runtimeState = "resume_failed";
      renderWorkspace();
      renderHistory();
      setAppNotice(`ACP runtime 恢复失败，保留只读 transcript：${formatBackendError(resumeError || loadError)}`, "error");
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
      turn,
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
    renderWorkspace();
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
    renderWorkspace();
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke(commands.prompt, {
      runtimeSessionId: session.id,
      prompt: turn.task,
      cwd: null,
      profileCommand: session.profileCommand || null,
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

  const agent = currentMainAgent();
  const provider = currentMainProvider();
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
        if (activeSessionIds[session.agentId] === session.id) {
          delete activeSessionIds[session.agentId];
        }
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
