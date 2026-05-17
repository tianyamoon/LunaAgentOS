const { invoke } = window.__TAURI__.core;

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

const fallbackSessions = {
  hermes: {
    state: 1,
    task: "等待接入 WSL Hermes 真实会话",
    summary: "WSL 中已经检测到 Hermes 运行时。等环境确认后，控制台将直接切到真实会话。",
    events: [
      { type: "state", state: 0, payload: { content: "Hermes 运行时已被探测到，等待接线。" } },
      { type: "state", state: 1, payload: { content: "当前尚未向 WSL Hermes 下发真实任务。" } },
    ],
  },
  trae: {
    state: 1,
    task: "等待 Trae IDE Bridge 方案",
    summary: "Trae IDE 属于免费入口，控制台将把它作为独立 Bridge 线路推进，而不是伪装成原生 CLI。",
    events: [
      { type: "state", state: 1, payload: { content: "Trae IDE Bridge 尚未接通。" } },
      { type: "log", state: 1, payload: { content: "当前阶段优先打通 Claude Code 与 Hermes 的真实运行时。" } },
    ],
  },
};

const agents = [
  {
    id: "claude",
    name: "Claude Code",
    role: "强大样板",
    note: "优先承接真实高价值 CLI 运行时。",
    task: "请检查当前工作目录，确认 LunaAgentOS 已有哪些可验证产物，并给出下一步最应该接入的真实 Agent。",
    state: 1,
    runtimeStatus: "未探测",
  },
  {
    id: "hermes",
    name: "Hermes",
    role: "通用样板",
    note: "适合作为现实世界里最稳的通用接入目标。",
    task: "总结当前适配器验证状态，并整理接入 WSL Hermes 前的准备项。",
    state: 1,
    runtimeStatus: "未探测",
  },
  {
    id: "trae",
    name: "Trae IDE",
    role: "免费样板",
    note: "产品必须纳入，但当前仍按 Bridge 路线推进。",
    task: "梳理最轻的 IDE Bridge 方案。",
    state: 1,
    runtimeStatus: "Bridge 待实现",
  },
];

const agentList = document.getElementById("agentList");
const sessionTitle = document.getElementById("sessionTitle");
const sessionSubtitle = document.getElementById("sessionSubtitle");
const stateBadge = document.getElementById("stateBadge");
const heroCard = document.getElementById("heroCard");
const heroTask = document.getElementById("heroTask");
const heroSummary = document.getElementById("heroSummary");
const messageStream = document.getElementById("messageStream");
const toolPanel = document.getElementById("toolPanel");
const timeline = document.getElementById("timeline");
const stateLegend = document.getElementById("stateLegend");
const promptBox = document.getElementById("promptBox");
const refreshBtn = document.getElementById("refreshBtn");
const runBtn = document.getElementById("runBtn");
const sendBtn = document.getElementById("sendBtn");

let currentAgentId = "claude";
let currentEvents = [];

function renderLegend() {
  stateLegend.innerHTML = "";
  Object.entries(stateNames).forEach(([state, label]) => {
    const pill = document.createElement("div");
    pill.className = `legend-pill ${stateClasses[state] || "state-idle"}`;
    pill.textContent = `${state} · ${label}`;
    stateLegend.appendChild(pill);
  });
}

function agentById(id) {
  return agents.find((item) => item.id === id);
}

function formatStatusText(status) {
  if (!status) return "未探测";
  if (status.available) return `已连接 · ${status.detail || status.version || "可用"}`;
  return `未连接 · ${status.detail || "未就绪"}`;
}

function renderAgents() {
  agentList.innerHTML = "";
  agents.forEach((agent) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `agent-card ${agent.id === currentAgentId ? "active" : ""}`;
    card.innerHTML = `
      <div class="agent-topline">
        <strong>${agent.name}</strong>
        <span class="state-pill ${stateClasses[agent.state] || "state-idle"}">${stateNames[agent.state]}</span>
      </div>
      <div class="agent-role">${agent.role}</div>
      <p class="caption">${agent.note}</p>
      <div class="runtime-status"><strong>运行时</strong> ${agent.runtimeStatus}</div>
    `;
    card.addEventListener("click", () => {
      currentAgentId = agent.id;
      renderAgents();
      renderCurrentSession();
      renderSessionEvents(currentEvents);
    });
    agentList.appendChild(card);
  });
}

function resetSessionView() {
  messageStream.innerHTML = "";
  toolPanel.innerHTML = "<p>当前没有工具调用</p>";
  toolPanel.classList.add("empty");
  timeline.innerHTML = "";
}

function renderCurrentSession() {
  const agent = agentById(currentAgentId);
  if (!agent) return;
  sessionTitle.textContent = agent.name;
  sessionSubtitle.textContent = agent.role;
  heroTask.textContent = agent.task;
  heroSummary.textContent = agent.note;
  updateStateBadge(agent.state);
}

function updateStateBadge(state) {
  stateBadge.textContent = stateNames[state] || "UNKNOWN";
  stateBadge.className = `state-badge ${stateClasses[state] || "state-idle"}`;
  heroCard.classList.toggle("breathing", state === 2 || state === 3);
}

function appendTimelineItem(event, timestamp) {
  const row = document.createElement("div");
  row.className = "timeline-item";
  row.innerHTML = `
    <div class="timeline-meta">
      <span>${stateNames[event.state] || event.state}</span>
      <span>${timestamp}</span>
    </div>
    <strong>${event.type}</strong>
    <p>${event.payload.content || "无文本内容"}</p>
  `;
  timeline.prepend(row);
}

function appendMessage(event) {
  const wrapper = document.createElement("div");
  wrapper.className = "message";
  wrapper.innerHTML = `
    <div class="message-head">
      <span class="message-type">${event.type}</span>
      <span>${stateNames[event.state] || event.state}</span>
    </div>
    <div>${event.payload.content || "无文本内容"}</div>
  `;
  messageStream.appendChild(wrapper);
  messageStream.scrollTop = messageStream.scrollHeight;
}

function renderTool(event) {
  toolPanel.classList.remove("empty");
  const item = document.createElement("div");
  item.className = "tool-item";
  item.innerHTML = `
    <strong>${event.payload.tool_name || "runtime_call"}</strong>
    <div class="caption">${event.payload.content || "工具调用"}</div>
    <pre>${JSON.stringify(event.payload.tool_args || event.payload, null, 2)}</pre>
  `;
  toolPanel.prepend(item);
}

function applyAgentState(agentId, events) {
  const agent = agentById(agentId);
  if (!agent) return;
  const lastState = [...events].reverse().find((event) => typeof event.state === "number");
  if (lastState) agent.state = lastState.state;
}

function renderSessionEvents(events) {
  resetSessionView();
  currentEvents = events;
  events.forEach((event) => {
    appendMessage(event);
    appendTimelineItem(event, new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    if (event.type === "tool_request") {
      renderTool(event);
    }
  });
}

async function refreshRuntimeStatus() {
  const statuses = await invoke("probe_runtimes");
  agents.forEach((agent) => {
    const status = statuses[agent.id];
    agent.runtimeStatus = formatStatusText(status);
  });
  renderAgents();
}

async function runClaudeTask() {
  const prompt = promptBox.value.trim();
  const events = await invoke("run_claude_stream", { prompt });
  applyAgentState("claude", events);
  currentAgentId = "claude";
  const claude = agentById("claude");
  claude.task = prompt;
  claude.note = "真实 Claude Code CLI 会话已完成一轮任务。";
  heroSummary.textContent = "Claude Code 真实运行时已返回结构化事件流。";
  renderAgents();
  renderCurrentSession();
  renderSessionEvents(events);
}

async function openAgent(agentId) {
  currentAgentId = agentId;
  const agent = agentById(agentId);
  renderAgents();
  renderCurrentSession();

  if (agentId === "claude") {
    try {
      const statuses = await invoke("probe_runtimes");
      const status = statuses.claude;
      agent.runtimeStatus = formatStatusText(status);
      if (status?.available) {
        const events = await invoke("probe_claude_session");
        applyAgentState("claude", events);
        renderAgents();
        renderCurrentSession();
        renderSessionEvents(events);
        return;
      }
    } catch (error) {
      console.error(error);
    }
  }

  const fallback = fallbackSessions[agentId];
  if (fallback) {
    agent.state = fallback.state;
    agent.task = fallback.task;
    agent.note = fallback.summary;
    renderAgents();
    renderCurrentSession();
    renderSessionEvents(fallback.events);
  } else {
    renderSessionEvents([]);
  }
}

refreshBtn.addEventListener("click", async () => {
  await refreshRuntimeStatus();
  await openAgent(currentAgentId);
});

runBtn.addEventListener("click", async () => {
  if (currentAgentId === "claude") {
    await runClaudeTask();
    return;
  }
  await openAgent(currentAgentId);
});

sendBtn.addEventListener("click", async () => {
  heroTask.textContent = promptBox.value.trim() || "空任务";
  if (currentAgentId === "claude") {
    await runClaudeTask();
  } else {
    await openAgent(currentAgentId);
  }
});

renderLegend();
renderAgents();
renderCurrentSession();
refreshRuntimeStatus().then(() => openAgent(currentAgentId));
