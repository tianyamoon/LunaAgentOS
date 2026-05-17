import { agents, sampleEvents, stateNames } from "./sample-data.js";

const stateClasses = {
  0: "state-init",
  1: "state-idle",
  2: "state-think",
  3: "state-tooling",
  4: "state-resp",
  5: "state-done",
  9: "state-error",
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
let activeTimeline = [];
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
    });
    agentList.appendChild(card);
  });
}

function resetSessionView() {
  activeTimeline = [];
  messageStream.innerHTML = "";
  toolPanel.innerHTML = "<p>暂无工具调用</p>";
  toolPanel.classList.add("empty");
  timeline.innerHTML = "";
}

function renderCurrentSession() {
  const agent = agents.find((item) => item.id === currentAgentId);
  if (!agent) {
    return;
  }
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
  if (!agent) {
    return;
  }
  agent.state = event.state;
  updateStateBadge(event.state);
  appendMessage(event);
  appendTimelineItem(event, new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  if (event.type === "tool_request") {
    renderTool(event);
  }
  if (event.state === 4) {
    heroSummary.textContent = "任务正在输出最终结果，准备进入归档阶段。";
  }
  if (event.state === 5) {
    heroSummary.textContent = "任务已完成，控制台可将该会话折叠归档。";
  }
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
  agents.forEach((agent) => {
    agent.state = 1;
  });
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
