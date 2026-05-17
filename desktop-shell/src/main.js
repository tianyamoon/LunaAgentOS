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

const agents = [
  {
    id: "claude",
    name: "Claude Code",
    role: "强大样板",
    note: "代表高价值、强能力的付费 Agent 目标。",
    task: "等待接入 Claude Code 真实运行时",
    state: 1,
  },
  {
    id: "hermes",
    name: "Hermes",
    role: "通用样板",
    note: "首个最适合推进真实 CLI Adapter 的现实目标。",
    task: "总结当前适配器验证结果，并决定下一步真实接入顺序。",
    state: 1,
  },
  {
    id: "trae",
    name: "Trae IDE",
    role: "免费样板",
    note: "产品上必须纳入，但工程上应走 Bridge 路线。",
    task: "规划 IDE Bridge 方案，不伪装成原生 CLI。",
    state: 1,
  },
];

const sampleEvents = {
  hermes: [
    { type: "state", state: 0, payload: { content: "Hermes adapter 正在启动进程与会话。" } },
    { type: "thought", state: 2, payload: { content: "正在分析当前协议验证结果，并准备整理下一步接入顺序。" } },
    {
      type: "tool_request",
      state: 3,
      payload: {
        content: "调用本地验证结果与目标矩阵。",
        tool_name: "load_validation_report",
        tool_args: { file: "docs/validation-report.md", matrix: "docs/target-matrix.md" },
      },
    },
    {
      type: "response",
      state: 4,
      payload: { content: "当前 mock 协议链已验证通过。建议先接 Hermes，再推进 Claude Code，并单独研究 Trae IDE Bridge。" },
    },
    { type: "state", state: 5, payload: { content: "当前任务已完成，等待归档。" } },
  ],
  claude: [
    { type: "state", state: 0, payload: { content: "Claude Code 会话初始化中。" } },
    { type: "thought", state: 2, payload: { content: "高价值样板正在评估任务请求与上下文。" } },
    {
      type: "tool_request",
      state: 3,
      payload: { content: "分析代码与协议文档。", tool_name: "code_scan", tool_args: { scope: "adapter protocol", target: "LunaAgentOS" } },
    },
    {
      type: "response",
      state: 4,
      payload: { content: "Claude Code 样板适合作为第二个真实接入目标，用来证明 LunaAgentOS 的高端用户相关性。" },
    },
    { type: "state", state: 5, payload: { content: "Claude Code 样板输出完成。" } },
  ],
  trae: [
    { type: "state", state: 0, payload: { content: "Trae IDE Bridge 方案初始化。" } },
    { type: "thought", state: 2, payload: { content: "当前重点不是伪造 CLI 接入，而是评估 IDE-first 产品的桥接面。" } },
    {
      type: "tool_request",
      state: 3,
      payload: {
        content: "比较可行的 Bridge 方案。",
        tool_name: "bridge_research",
        tool_args: { candidates: ["桌面自动化", "IDE 插件桥", "终端桥接", "会话代理"] },
      },
    },
    {
      type: "response",
      state: 4,
      payload: { content: "Trae IDE 在产品上属于免费样板，但工程上应作为独立 Bridge 路线推进。" },
    },
    { type: "state", state: 5, payload: { content: "Trae IDE 样板分析完成。" } },
  ],
};

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
const playBtn = document.getElementById("playBtn");
const resetBtn = document.getElementById("resetBtn");
const sendBtn = document.getElementById("sendBtn");

let currentAgentId = "hermes";
let playbackTimer = null;

function renderLegend() {
  stateLegend.innerHTML = "";
  Object.entries(stateNames).forEach(([state, label]) => {
    const pill = document.createElement("div");
    pill.className = `legend-pill ${stateClasses[state] || "state-idle"}`;
    pill.textContent = `${state} · ${label}`;
    stateLegend.appendChild(pill);
  });
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
    `;
    card.addEventListener("click", () => {
      currentAgentId = agent.id;
      renderAgents();
      renderCurrentSession();
      resetSessionView();
    });
    agentList.appendChild(card);
  });
}

function resetSessionView() {
  messageStream.innerHTML = "";
  toolPanel.innerHTML = "<p>暂无工具调用</p>";
  toolPanel.classList.add("empty");
  timeline.innerHTML = "";
}

function renderCurrentSession() {
  const agent = agents.find((item) => item.id === currentAgentId);
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
    <strong>${event.payload.tool_name || "unknown_tool"}</strong>
    <div class="caption">${event.payload.content || "工具调用"}</div>
    <pre>${JSON.stringify(event.payload.tool_args || {}, null, 2)}</pre>
  `;
  toolPanel.prepend(item);
}

function handleEvent(event) {
  const agent = agents.find((item) => item.id === currentAgentId);
  if (!agent) return;
  agent.state = event.state;
  updateStateBadge(event.state);
  appendMessage(event);
  appendTimelineItem(event, new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  if (event.type === "tool_request") renderTool(event);
  if (event.state === 4) heroSummary.textContent = "任务正在输出最终结果，准备进入归档阶段。";
  if (event.state === 5) heroSummary.textContent = "任务已完成，控制台可将该会话折叠归档。";
  renderAgents();
}

function playSampleSession() {
  clearPlayback();
  resetSessionView();
  renderCurrentSession();
  const events = sampleEvents[currentAgentId] || [];
  let cursor = 0;
  playbackTimer = window.setInterval(() => {
    const event = events[cursor];
    if (!event) {
      clearPlayback();
      return;
    }
    handleEvent(event);
    cursor += 1;
  }, 950);
}

function clearPlayback() {
  if (playbackTimer) {
    window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
}

function resetAgents() {
  clearPlayback();
  agents.forEach((agent) => { agent.state = 1; });
  resetSessionView();
  renderAgents();
  renderCurrentSession();
}

playBtn.addEventListener("click", playSampleSession);
resetBtn.addEventListener("click", resetAgents);
sendBtn.addEventListener("click", () => {
  heroTask.textContent = promptBox.value.trim() || "空任务";
  heroSummary.textContent = "这是人类工作台发出的当前任务描述。";
});

renderLegend();
renderAgents();
renderCurrentSession();
