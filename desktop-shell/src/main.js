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

const providers = [
  {
    id: "claude",
    name: "Claude Code",
    lane: "强大入口",
    note: "优先承接真实高价值 CLI 运行时。",
    runtimeStatus: "未探测",
    agents: [
      {
        id: "claude-main",
        providerId: "claude",
        name: "主会话",
        subtitle: "Windows CLI",
        task: "请检查当前工作目录，确认 LunaAgentOS 已有哪些可验证产物，并给出下一步最应该接入的真实 Agent。",
        note: "优先承接真实高价值 CLI 运行时。",
        state: 1,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    lane: "通用入口",
    note: "适合作为现实世界里最稳的通用接入目标。",
    runtimeStatus: "未探测",
    agents: [
      {
        id: "hermes-main",
        providerId: "hermes",
        name: "主会话",
        subtitle: "WSL Runtime",
        task: "总结当前适配器验证状态，并整理接入 WSL Hermes 前的准备项。",
        note: "适合作为现实世界里最稳的通用接入目标。",
        state: 1,
      },
    ],
  },
  {
    id: "trae",
    name: "Trae IDE",
    lane: "免费入口",
    note: "产品必须纳入，但当前仍按 Bridge 路线推进。",
    runtimeStatus: "Bridge 待实现",
    agents: [
      {
        id: "trae-main",
        providerId: "trae",
        name: "主会话",
        subtitle: "IDE Bridge",
        task: "梳理最轻的 IDE Bridge 方案。",
        note: "产品必须纳入，但当前仍按 Bridge 路线推进。",
        state: 1,
      },
    ],
  },
];

const agentList = document.getElementById("agentList");
const providerManagerBtn = document.getElementById("providerManagerBtn");
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

let currentAgentId = "claude-main";
let currentEvents = [];

function allAgents() {
  return providers.flatMap((provider) => provider.agents);
}

function providerById(id) {
  return providers.find((provider) => provider.id === id);
}

function agentById(id) {
  return allAgents().find((agent) => agent.id === id);
}

function providerForAgent(agentId) {
  const agent = agentById(agentId);
  return agent ? providerById(agent.providerId) : null;
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

function renderLegend() {
  stateLegend.innerHTML = "";
  Object.entries(stateNames).forEach(([state, label]) => {
    const pill = document.createElement("div");
    pill.className = `legend-pill ${stateClasses[state] || "state-idle"}`;
    pill.textContent = `${state} · ${label}`;
    stateLegend.appendChild(pill);
  });
}

function formatStatusText(status) {
  if (!status) return "未探测";
  if (status.available) return `已连接 · ${status.detail || status.version || "可用"}`;
  return `未连接 · ${status.detail || "未就绪"}`;
}

function listProviderAgents(provider) {
  const names = provider.agents.map((agent) => agent.name).join("、");
  window.alert(`${provider.name} 当前 agent：${names}`);
}

function openProviderManager() {
  window.alert("Provider 管理器稍后接入。当前先保留入口。");
}

function renderProviders() {
  agentList.innerHTML = "";

  providers.forEach((provider) => {
    const group = document.createElement("section");
    group.className = "provider-group";

    const aggregateState = providerState(provider);
    const isActiveProvider = provider.agents.some((agent) => agent.id === currentAgentId);

    group.innerHTML = `
      <div class="provider-header">
        <div>
          <div class="provider-title-row">
            <strong>${provider.name}</strong>
            <span class="state-pill ${stateClasses[aggregateState] || "state-idle"}">${stateNames[aggregateState]}</span>
          </div>
          <div class="provider-lane">${provider.lane}</div>
        </div>
        <div class="provider-actions">
          <button type="button" class="mini-btn ghost-btn provider-manage-btn" data-provider-id="${provider.id}">维护</button>
        </div>
      </div>
      <p class="caption provider-note">${provider.note}</p>
      <div class="runtime-status"><strong>运行时</strong> ${provider.runtimeStatus}</div>
      <div class="provider-agents ${isActiveProvider ? "provider-agents-active" : ""}">
        ${provider.agents.map((agent) => `
          <button type="button" class="agent-entry ${agent.id === currentAgentId ? "active" : ""}" data-agent-id="${agent.id}">
            <div class="agent-entry-top">
              <strong>${agent.name}</strong>
              <span class="state-pill ${stateClasses[agent.state] || "state-idle"}">${stateNames[agent.state]}</span>
            </div>
            <div class="agent-entry-sub">${agent.subtitle}</div>
          </button>
        `).join("")}
      </div>
      <button type="button" class="mini-btn add-agent-btn" data-provider-id="${provider.id}">+ 新增 Agent</button>
    `;

    agentList.appendChild(group);
  });

  agentList.querySelectorAll(".agent-entry").forEach((button) => {
    button.addEventListener("click", async () => {
      const agentId = button.dataset.agentId;
      if (!agentId) return;
      await openAgent(agentId);
    });
  });

  agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProviderManager();
    });
  });

  agentList.querySelectorAll(".add-agent-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const providerId = button.dataset.providerId;
      const provider = providerById(providerId);
      if (!provider) return;
      listProviderAgents(provider);
    });
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
  const provider = providerForAgent(currentAgentId);
  if (!agent || !provider) return;

  sessionTitle.textContent = provider.name;
  sessionSubtitle.textContent = `${provider.lane} · ${agent.name}`;
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
    appendTimelineItem(
      event,
      new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    );
    if (event.type === "tool_request") {
      renderTool(event);
    }
  });
}

async function refreshRuntimeStatus() {
  const statuses = await invoke("probe_runtimes");
  providers.forEach((provider) => {
    const status = statuses[provider.id];
    provider.runtimeStatus = formatStatusText(status);
  });
  renderProviders();
}

async function runClaudeTask() {
  const prompt = promptBox.value.trim();
  const events = await invoke("run_claude_stream", { prompt });
  applyAgentState("claude-main", events);
  currentAgentId = "claude-main";
  const claude = agentById("claude-main");
  claude.task = prompt;
  claude.note = "真实 Claude Code CLI 会话已完成一轮任务。";
  heroSummary.textContent = "Claude Code 真实运行时已返回结构化事件流。";
  renderProviders();
  renderCurrentSession();
  renderSessionEvents(events);
}

async function openAgent(agentId) {
  currentAgentId = agentId;
  const agent = agentById(agentId);
  const provider = providerForAgent(agentId);
  if (!agent || !provider) return;

  renderProviders();
  renderCurrentSession();

  if (provider.id === "claude") {
    try {
      const statuses = await invoke("probe_runtimes");
      const status = statuses.claude;
      provider.runtimeStatus = formatStatusText(status);
      if (status?.available) {
        const events = await invoke("probe_claude_session");
        applyAgentState("claude-main", events);
        renderProviders();
        renderCurrentSession();
        renderSessionEvents(events);
        return;
      }
    } catch (error) {
      console.error(error);
    }
  }

  const fallback = fallbackSessions[provider.id];
  if (fallback) {
    agent.state = fallback.state;
    agent.task = fallback.task;
    agent.note = fallback.summary;
    renderProviders();
    renderCurrentSession();
    renderSessionEvents(fallback.events);
  } else {
    renderSessionEvents([]);
  }
}

providerManagerBtn?.addEventListener("click", () => {
  openProviderManager();
});

refreshBtn.addEventListener("click", async () => {
  await refreshRuntimeStatus();
  await openAgent(currentAgentId);
});

runBtn.addEventListener("click", async () => {
  const provider = providerForAgent(currentAgentId);
  if (provider?.id === "claude") {
    await runClaudeTask();
    return;
  }
  await openAgent(currentAgentId);
});

sendBtn.addEventListener("click", async () => {
  const agent = agentById(currentAgentId);
  if (agent) {
    agent.task = promptBox.value.trim() || "空任务";
  }
  if (providerForAgent(currentAgentId)?.id === "claude") {
    await runClaudeTask();
  } else {
    await openAgent(currentAgentId);
  }
});

renderLegend();
renderProviders();
renderCurrentSession();
refreshRuntimeStatus().then(() => openAgent(currentAgentId));
