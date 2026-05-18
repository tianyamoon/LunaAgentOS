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
    runtimeStatus: "等待刷新",
    agents: [
      {
        id: "claude-main",
        providerId: "claude",
        name: "主会话",
        subtitle: "Windows CLI",
        note: "适合承接高价值任务与真实产品演示。",
        state: 1,
      },
      {
        id: "claude-review",
        providerId: "claude",
        name: "代码审阅",
        subtitle: "预留",
        note: "用于后续拆分同一 provider 下的多 agent 角色。",
        state: 1,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    lane: "通用入口",
    note: "已探测到 WSL 运行时，等待主链路接通。",
    runtimeStatus: "等待刷新",
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
    runtimeStatus: "等待刷新",
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

const agentList = document.getElementById("agentList");
const providerManagerBtn = document.getElementById("providerManagerBtn");
const workspaceStatus = document.getElementById("workspaceStatus");
const workspaceEmpty = document.getElementById("workspaceEmpty");
const sessionDeck = document.getElementById("sessionDeck");
const historyList = document.getElementById("historyList");
const promptBox = document.getElementById("promptBox");
const refreshBtn = document.getElementById("refreshBtn");
const runBtn = document.getElementById("runBtn");
const sendBtn = document.getElementById("sendBtn");

let mainAgentId = localStorage.getItem(MAIN_AGENT_KEY) || "claude-main";
let sessions = [];
let historyEntries = [];
let sessionSeq = 0;

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

function currentMainAgent() {
  return agentById(mainAgentId);
}

function currentMainProvider() {
  return providerForAgent(mainAgentId);
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

function formatStatusText(status) {
  if (!status) return "等待刷新";
  if (status.available) return `已连接 · ${status.detail || status.version || "可用"}`;
  return `未连接 · ${status.detail || "未就绪"}`;
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

function saveMainAgent(agentId) {
  mainAgentId = agentId;
  localStorage.setItem(MAIN_AGENT_KEY, agentId);
}

function openProviderManager() {
  window.alert("Provider 管理器入口已预留，后续再接入。");
}

function showProviderAgents(provider) {
  const names = provider.agents.map((agent) => agent.name).join("、");
  window.alert(`${provider.name} 当前 agent：${names}`);
}

function setMainAgent(agentId) {
  saveMainAgent(agentId);
  const agent = currentMainAgent();
  const provider = currentMainProvider();
  if (agent && provider) {
    workspaceStatus.textContent = `当前主 Agent：${provider.name} / ${agent.name}`;
  }
  renderProviders();
}

function renderProviders() {
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
      <div class="runtime-status"><strong>运行时</strong> ${provider.runtimeStatus}</div>
      <div class="provider-agents">
        ${provider.agents.map((agent) => `
          <div class="agent-entry">
            <div class="agent-entry-top">
              <strong>${agent.name}</strong>
              <span class="state-pill ${stateClasses[agent.state] || "state-idle"}">${stateNames[agent.state]}</span>
            </div>
            <div class="agent-entry-sub">${agent.subtitle}</div>
            <div class="agent-entry-actions">
              ${agent.id === mainAgentId
                ? `<span class="main-agent-badge">主 Agent</span>`
                : `<button type="button" class="mini-btn set-main-btn" data-agent-id="${agent.id}">设为主 Agent</button>`}
            </div>
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

  agentList.querySelectorAll(".set-main-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const agentId = button.dataset.agentId;
      if (!agentId) return;
      setMainAgent(agentId);
    });
  });

  agentList.querySelectorAll(".add-agent-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const providerId = button.dataset.providerId;
      const provider = providerById(providerId);
      if (!provider) return;
      showProviderAgents(provider);
    });
  });
}

function sessionSectionsFromEvents(events) {
  const sections = {
    thoughts: [],
    outputs: [],
    finalResponse: "",
    logs: [],
  };

  events.forEach((event) => {
    const content = event.payload?.content || "";
    if (!content) return;

    if (event.type === "thought") {
      sections.thoughts.push(content);
      return;
    }

    if (event.type === "response") {
      sections.outputs.push(content);
      sections.finalResponse = content;
      return;
    }

    if (event.type === "state" && event.state === 5) {
      if (!sections.finalResponse) {
        sections.finalResponse = content;
      } else {
        sections.logs.push(content);
      }
      return;
    }

    sections.logs.push(content);
  });

  return sections;
}

function createSession(task) {
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
    task,
    state: 0,
    thoughts: [],
    outputs: [],
    finalResponse: "",
    logs: ["会话已创建，等待运行时返回内容。"],
    createdAt: new Date().toISOString(),
    fullscreen: false,
  };
  sessions = [session, ...sessions];
  renderWorkspace();
  return session;
}

function updateSessionFromEvents(sessionId, events) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;

  const sections = sessionSectionsFromEvents(events);
  const lastState = [...events].reverse().find((event) => typeof event.state === "number");

  session.thoughts = sections.thoughts;
  session.outputs = sections.outputs;
  session.finalResponse = sections.finalResponse;
  session.logs = sections.logs;
  session.state = lastState ? lastState.state : session.state;
  renderWorkspace();
  return session;
}

function appendErrorToSession(sessionId, message) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  session.state = 9;
  session.logs = [message, ...session.logs];
  renderWorkspace();
}

function renderWorkspaceStatus() {
  const agent = currentMainAgent();
  const provider = currentMainProvider();
  if (!agent || !provider) {
    workspaceStatus.textContent = "请先设置主 Agent。";
    return;
  }
  workspaceStatus.textContent = `当前主 Agent：${provider.name} / ${agent.name}`;
}

function renderSessionCard(session) {
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""}" data-session-id="${session.id}">
      <div class="session-card-header">
        <div>
          <div class="session-card-title-row">
            <strong>${session.agentName}</strong>
            <span class="state-pill ${stateClasses[session.state] || "state-idle"}">${formatSessionStatus(session)}</span>
          </div>
          <div class="caption session-task">${session.task}</div>
        </div>
        <button type="button" class="mini-btn ghost-btn session-fullscreen-btn" data-session-id="${session.id}">
          ${session.fullscreen ? "退出全屏" : "全屏"}
        </button>
      </div>
      <div class="session-card-body">
        <section class="flow-block">
          <div class="flow-title">思考流</div>
          <div class="flow-content">
            ${session.thoughts.length
              ? session.thoughts.map((item) => `<p>${item}</p>`).join("")
              : "<p class='flow-empty'>当前没有思考流内容。</p>"}
          </div>
        </section>
        <section class="flow-block">
          <div class="flow-title">输出流</div>
          <div class="flow-content">
            ${session.outputs.length
              ? session.outputs.map((item) => `<p>${item}</p>`).join("")
              : "<p class='flow-empty'>当前没有输出流内容。</p>"}
          </div>
        </section>
        <section class="flow-block final-block">
          <div class="flow-title">最终响应</div>
          <div class="flow-content">
            <p>${session.finalResponse || "最终响应尚未返回。"}</p>
          </div>
        </section>
        ${session.logs.length
          ? `
            <section class="flow-block log-block">
              <div class="flow-title">状态记录</div>
              <div class="flow-content">
                ${session.logs.map((item) => `<p>${item}</p>`).join("")}
              </div>
            </section>
          `
          : ""}
      </div>
    </article>
  `;
}

function bindSessionActions() {
  sessionDeck.querySelectorAll(".session-fullscreen-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionId;
      const session = sessions.find((item) => item.id === sessionId);
      if (!session) return;
      session.fullscreen = !session.fullscreen;
      renderWorkspace();
    });
  });
}

function renderWorkspace() {
  renderWorkspaceStatus();
  workspaceEmpty.style.display = sessions.length ? "none" : "flex";
  sessionDeck.innerHTML = sessions.map(renderSessionCard).join("");
  bindSessionActions();
}

function groupHistory(entries) {
  return entries.reduce((groups, entry) => {
    if (!groups[entry.date]) groups[entry.date] = [];
    groups[entry.date].push(entry);
    return groups;
  }, {});
}

function renderHistory() {
  if (!historyEntries.length) {
    historyList.innerHTML = `
      <div class="history-empty">
        <strong>暂无历史任务</strong>
        <p>第一次发送给主 Agent 后，这里会按日期记录任务摘要。</p>
      </div>
    `;
    return;
  }

  const groups = groupHistory(historyEntries);
  const dates = Object.keys(groups).sort((left, right) => right.localeCompare(left));

  historyList.innerHTML = dates.map((date) => `
    <section class="history-group">
      <div class="history-date">${date}</div>
      <div class="history-group-list">
        ${groups[date].map((entry) => `
          <article class="history-item">
            <div class="history-item-top">
              <strong>${entry.provider_name}</strong>
              <span>${formatTime(entry.created_at)}</span>
            </div>
            <div class="caption">${entry.agent_name}</div>
            <p>${entry.summary}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
}

async function loadHistory() {
  try {
    historyEntries = await invoke("load_history_entries");
  } catch (error) {
    console.error(error);
    historyEntries = [];
  }
  renderHistory();
}

async function saveSessionToHistory(session) {
  const entry = await invoke("append_history_entry", {
    entry: {
      providerId: session.providerId,
      providerName: session.providerName,
      agentId: session.agentId,
      agentName: session.agentName,
      task: session.task,
      status: formatSessionStatus(session),
      summary: session.finalResponse || session.outputs.at(-1) || session.logs.at(0) || "会话已结束。",
    },
  });
  historyEntries = [entry, ...historyEntries];
  renderHistory();
}

async function refreshRuntimeStatus() {
  try {
    const statuses = await invoke("probe_runtimes");
    providers.forEach((provider) => {
      provider.runtimeStatus = formatStatusText(statuses[provider.id]);
    });
    renderProviders();
  } catch (error) {
    console.error(error);
  }
}

async function startFallbackSession(session, providerId) {
  const fallback = fallbackSessions[providerId];
  if (!fallback) return;
  const saved = updateSessionFromEvents(session.id, fallback.events);
  if (saved) {
    await saveSessionToHistory(saved);
  }
}

async function startClaudeSession(session) {
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke("run_claude_stream", { prompt: session.task });
    const saved = updateSessionFromEvents(session.id, events);
    if (saved) {
      const agent = agentById(saved.agentId);
      if (agent) {
        agent.state = saved.state;
      }
      renderProviders();
      await saveSessionToHistory(saved);
    }
  } catch (error) {
    appendErrorToSession(session.id, String(error));
    const failed = sessions.find((item) => item.id === session.id);
    if (failed) {
      await saveSessionToHistory(failed);
    }
  }
}

async function startSessionFromPrompt() {
  const task = promptBox.value.trim();
  if (!task) {
    promptBox.focus();
    return;
  }

  const agent = currentMainAgent();
  const provider = currentMainProvider();
  if (!agent || !provider) {
    window.alert("请先在左侧设定主 Agent。");
    return;
  }

  const session = createSession(task);
  if (!session) return;

  if (provider.id === "claude") {
    await startClaudeSession(session);
    return;
  }

  await startFallbackSession(session, provider.id);
}

providerManagerBtn?.addEventListener("click", () => {
  openProviderManager();
});

refreshBtn.addEventListener("click", async () => {
  await refreshRuntimeStatus();
});

runBtn.addEventListener("click", async () => {
  await startSessionFromPrompt();
});

sendBtn.addEventListener("click", async () => {
  await startSessionFromPrompt();
});

renderProviders();
renderWorkspace();
loadHistory();
