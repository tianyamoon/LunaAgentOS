import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

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
  0: "启动中",
  1: "待命",
  2: "思考中",
  3: "调用工具",
  4: "响应中",
  5: "完成",
  6: "已停止",
  9: "异常",
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
  live: "可续聊",
  archived: "只读",
  restoring: "重连中",
  resume_failed: "重连失败",
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
const HERMES_ACP_STARTUP_NOTICE = "正在启动 ACP 运行时，首次响应可能较慢。";
const STREAM_RENDER_INTERVAL_MS = 80;

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

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

const translations = {
  "zh-CN": {
    "topbar.metricsAria": "当前能力状态",
    "topbar.demo": "演示场景",
    "topbar.clearDemo": "清除演示",
    "topbar.language": "语言：中文",
    "fleet.title": "Agent 舰队",
    "common.manage": "连接详情",
    "common.fixConnection": "修正连接",
    "workspace.title": "会话工作台",
    "workspace.defaultStatus": "请选择当前发送目标，然后发送第一条任务。",
    "workspace.emptyTitle": "会话尚未入场",
    "workspace.emptyText": "先在左侧设定当前发送目标，再通过底部输入框发起会话。",
    "workspace.currentTarget": "",
    "composer.send": "发送",
    "composer.demo": "演示中",
    "composer.enterSend": "Enter 发送",
    "composer.ctrlEnter": "Ctrl+Enter",
    "composer.newSession": "另开会话",
    "composer.placeholderTarget": "发送给 {target}",
    "composer.placeholderNoTarget": "先连接一个入口后再发送任务。",
    "history.title": "会话列表",
    "history.subtitle": "当前与归档",
    "history.loadingTitle": "会话列表加载中",
    "history.loadingText": "首屏先起工作台，会话归档会在后台补齐。",
    "history.emptyTitle": "暂无会话",
    "history.emptyText": "第一次发送后，这里会记录 Agent 会话，而不是每条对话详情。",
    "history.activeTitle": "活跃会话",
    "history.activeNote": "红灯在工作台，橙灯未进工作台",
    "history.activeEmpty": "暂无活跃会话。",
    "history.archiveTitle": "归档会话",
    "history.archiveNote": "用户手动归档，可恢复或删除",
    "history.archiveEmpty": "暂无归档会话。",
    "provider.setTarget": "设为发送目标",
    "provider.probing": "探测中",
    "provider.available": "可用",
    "provider.partial": "部分可用",
    "provider.notConnected": "未连接",
    "provider.not_configured": "未配置",
    "provider.unavailable": "不可用",
    "provider.planned": "规划中",
    "state.init": "启动中",
    "state.idle": "待命",
    "state.think": "思考中",
    "state.tooling": "调用工具",
    "state.response": "响应中",
    "state.done": "完成",
    "state.stopped": "已停止",
    "state.error": "异常",
    "runtime.live": "可续聊",
    "runtime.archived": "只读",
    "runtime.restoring": "重连中",
    "runtime.resumeFailed": "重连失败",
    "provider.claude.note": "面向开发者的命令行智能编程工具。",
    "provider.hermes.note": "通用入口，等待载入 Hermes profile。",
    "provider.hermes.loadedNote": "通用入口，已载入 {count} 个 Hermes profile。",
    "provider.noRuntime": "未检测到可用运行环境",
    "provider.noHermesRuntime": "未检测到 Win 或 WSL Hermes",
    "provider.noTargets": "暂未发现可发送目标",
    "provider.trae.note": "强大且免费的工具。",
    "agent.main": "主会话",
    "agent.claude.note": "适合承接高价值任务与真实产品演示。",
    "agent.hermes.note": "适合作为通用样板与后续多会话扩展对象。",
    "agent.trae.note": "作为免费入口保留产品位，等待独立桥接。",
    "font.compact": "字体：紧凑",
    "font.default": "字体：标准",
    "font.comfortable": "字体：舒展",
    "session.current": "当前会话",
    "session.task": "任务：{task}",
    "session.turns": "轮次 {count}",
    "session.thoughts": "思考 {count}",
    "session.logs": "运行 {count}",
    "session.responses": "响应 {count}",
    "session.noMessages": "当前会话尚未产生消息。",
    "session.hiddenTurns": "已隐藏前 {count} 轮，复制会话仍包含完整 transcript。",
    "turn.title": "第 {index} 轮",
    "turn.waiting": "等待响应...",
    "turn.thoughts": "思考流 · {count}",
    "turn.logs": "运行流 · {count}",
    "turn.copyTurn": "复制本轮",
    "turn.copyResponse": "复制响应",
    "history.signal.current": "当前会话",
    "history.signal.workspace": "工作台中",
    "history.signal.archive": "归档会话",
    "history.signal.live": "活跃会话",
    "history.delete": "删除会话",
    "history.newSession": "新会话",
    "session.ariaSwitch": "切换到会话：{task}",
    "session.statusAria": "会话状态：{state}",
    "session.statsAria": "会话统计",
    "session.actionsAria": "会话操作",
    "session.restoreRetry": "重试恢复",
    "action.stop": "停止运行",
    "action.dismiss": "移出工作台",
    "action.archive": "归档会话",
    "action.delete": "删除会话",
    "action.copySession": "复制会话",
    "action.showAllTurns": "显示全部轮次",
    "action.latestOnly": "只看最新轮次",
    "action.collapseFlows": "折叠过程流",
    "action.expandFlows": "展开过程流",
    "action.scrollLatest": "滚动到最新",
    "action.exitFullscreen": "退出全屏阅读",
    "action.enterFullscreen": "进入全屏阅读",
    "action.expandTurn": "展开本轮",
    "action.collapseTurn": "折叠本轮",
    "action.expandAllTurns": "展开全部轮次",
    "action.collapseAllTurns": "折叠全部轮次",
    "action.restoringSuffix": "（重连中，暂不可用）",
    "markdown.copySource": "复制源码",
    "markdown.copyCode": "复制代码",
    "markdown.diagramPreview": "Mermaid 流程图预览",
    "markdown.diagramRendering": "正在渲染 Mermaid 图表...",
    "markdown.diagramSource": "流程图源码",
    "markdown.diagramFallback": "如果渲染失败，将保留源码用于复制和排查。",
    "markdown.diagramFailed": "Mermaid 渲染失败，已保留源码。",
    "report.prelude": "过程前言 · 已折叠",
    "report.rawView": "原文报表视图",
    "report.rawHint": "检测到宽表/长行，优先保留原始排版",
    "report.renderedView": "查看 Markdown 渲染视图",
    "runtimeConfig.title": "Runtime 维护",
    "runtimeConfig.subtitle": "按本机环境配置当前入口。留空表示使用默认探测值。",
    "runtimeConfig.claudeTitle": "Claude Code",
    "runtimeConfig.hermesTitle": "Hermes",
    "runtimeConfig.command": "命令",
    "runtimeConfig.args": "参数",
    "runtimeConfig.host": "运行位置",
    "runtimeConfig.profile": "命令 / Profile alias",
    "runtimeConfig.commandHint": "例如 npx.cmd、npx，或你的 adapter 绝对路径",
    "runtimeConfig.argsHint": "空格分隔；留空使用默认 ACP adapter 参数",
    "runtimeConfig.hermesHint": "例如 hermes，或已探测到的 profile alias",
    "runtimeConfig.currentState": "当前状态：{state}",
    "runtimeConfig.save": "保存并重新探测",
    "runtimeConfig.cancel": "取消",
    "runtimeConfig.legacyPrompt": "使用旧版 prompt",
    "runtimeConfig.saving": "正在保存 Runtime 配置...",
    "runtimeConfig.saved": "Runtime 配置已保存。后续新建/恢复 ACP 会话会使用该配置。",
    "runtimeConfig.failed": "Runtime 配置读取或保存失败：{error}",
    "connection.title": "连接详情",
    "connection.subtitle": "这里只检查入口能不能打开；Agent/profile 来自运行时探测。",
    "connection.detected": "已检测到的运行环境",
    "connection.none": "暂未检测到可用运行环境。",
    "connection.recheck": "重新检查",
    "common.close": "关闭",
  },
  "en-US": {
    "topbar.metricsAria": "Current capability status",
    "topbar.demo": "Demo scene",
    "topbar.clearDemo": "Clear demo",
    "topbar.language": "Language: English",
    "fleet.title": "Agent Fleet",
    "common.manage": "Connection",
    "common.fixConnection": "Fix connection",
    "workspace.title": "Session Workspace",
    "workspace.defaultStatus": "Choose the current send target, then send the first task.",
    "workspace.emptyTitle": "No session yet",
    "workspace.emptyText": "Choose a send target on the left, then start a session from the composer.",
    "workspace.currentTarget": "",
    "composer.send": "Send",
    "composer.demo": "Demo",
    "composer.enterSend": "Enter sends",
    "composer.ctrlEnter": "Ctrl+Enter",
    "composer.newSession": "New session",
    "composer.placeholderTarget": "Send to {target}",
    "composer.placeholderNoTarget": "Connect an entry before sending.",
    "history.title": "Sessions",
    "history.subtitle": "Live and archived",
    "history.loadingTitle": "Loading sessions",
    "history.loadingText": "The workspace starts first; archived sessions load in the background.",
    "history.emptyTitle": "No sessions",
    "history.emptyText": "After the first send, Agent sessions will appear here.",
    "history.activeTitle": "Live sessions",
    "history.activeNote": "Red is in workspace, orange is detached",
    "history.activeEmpty": "No live sessions.",
    "history.archiveTitle": "Archived sessions",
    "history.archiveNote": "Manually archived, restorable or deletable",
    "history.archiveEmpty": "No archived sessions.",
    "provider.setTarget": "Set as target",
    "provider.probing": "Probing",
    "provider.available": "Ready",
    "provider.partial": "Partial",
    "provider.notConnected": "Not connected",
    "provider.not_configured": "Not configured",
    "provider.unavailable": "Unavailable",
    "provider.planned": "Planned",
    "state.init": "Starting",
    "state.idle": "Ready",
    "state.think": "Thinking",
    "state.tooling": "Using tools",
    "state.response": "Responding",
    "state.done": "Done",
    "state.stopped": "Stopped",
    "state.error": "Error",
    "runtime.live": "Live",
    "runtime.archived": "Read-only",
    "runtime.restoring": "Reconnecting",
    "runtime.resumeFailed": "Reconnect failed",
    "provider.claude.note": "Command-line coding agent for developers.",
    "provider.hermes.note": "General entry, waiting for Hermes profiles.",
    "provider.hermes.loadedNote": "General entry, loaded {count} Hermes profiles.",
    "provider.noRuntime": "No usable runtime detected",
    "provider.noHermesRuntime": "No Win or WSL Hermes detected",
    "provider.noTargets": "No send target detected yet",
    "provider.trae.note": "Powerful free IDE tool.",
    "agent.main": "Main session",
    "agent.claude.note": "Best for high-value tasks and real product demos.",
    "agent.hermes.note": "General template for runtime and multi-session expansion.",
    "agent.trae.note": "Reserved as a free entry until the IDE bridge is connected.",
    "font.compact": "Font: Compact",
    "font.default": "Font: Standard",
    "font.comfortable": "Font: Comfortable",
    "session.current": "Current session",
    "session.task": "Task: {task}",
    "session.turns": "Turns {count}",
    "session.thoughts": "Thoughts {count}",
    "session.logs": "Runtime {count}",
    "session.responses": "Responses {count}",
    "session.noMessages": "This session has no messages yet.",
    "session.hiddenTurns": "Hidden previous {count} turns. Copying the session still includes the full transcript.",
    "turn.title": "Turn {index}",
    "turn.waiting": "Waiting for response...",
    "turn.thoughts": "Thought stream · {count}",
    "turn.logs": "Runtime stream · {count}",
    "turn.copyTurn": "Copy turn",
    "turn.copyResponse": "Copy response",
    "history.signal.current": "Current session",
    "history.signal.workspace": "In workspace",
    "history.signal.archive": "Archived session",
    "history.signal.live": "Live session",
    "history.delete": "Delete session",
    "history.newSession": "New session",
    "session.ariaSwitch": "Switch to session: {task}",
    "session.statusAria": "Session status: {state}",
    "session.statsAria": "Session stats",
    "session.actionsAria": "Session actions",
    "session.restoreRetry": "Retry restore",
    "action.stop": "Stop runtime",
    "action.dismiss": "Remove from workspace",
    "action.archive": "Archive session",
    "action.delete": "Delete session",
    "action.copySession": "Copy session",
    "action.showAllTurns": "Show all turns",
    "action.latestOnly": "Latest turn only",
    "action.collapseFlows": "Collapse streams",
    "action.expandFlows": "Expand streams",
    "action.scrollLatest": "Scroll to latest",
    "action.exitFullscreen": "Exit fullscreen reading",
    "action.enterFullscreen": "Enter fullscreen reading",
    "action.expandTurn": "Expand this turn",
    "action.collapseTurn": "Collapse this turn",
    "action.expandAllTurns": "Expand all turns",
    "action.collapseAllTurns": "Collapse all turns",
    "action.restoringSuffix": " (reconnecting, unavailable)",
    "markdown.copySource": "Copy source",
    "markdown.copyCode": "Copy code",
    "markdown.diagramPreview": "Mermaid diagram preview",
    "markdown.diagramRendering": "Rendering Mermaid diagram...",
    "markdown.diagramSource": "Diagram source",
    "markdown.diagramFallback": "If rendering fails, the source stays available for copy and debugging.",
    "markdown.diagramFailed": "Mermaid rendering failed; source preserved.",
    "report.prelude": "Process prelude · collapsed",
    "report.rawView": "Raw report view",
    "report.rawHint": "Wide table or long lines detected; preserving original layout first",
    "report.renderedView": "View rendered Markdown",
    "runtimeConfig.title": "Runtime Maintenance",
    "runtimeConfig.subtitle": "Configure the selected entry for this machine. Empty fields use default probe values.",
    "runtimeConfig.claudeTitle": "Claude Code",
    "runtimeConfig.hermesTitle": "Hermes",
    "runtimeConfig.command": "Command",
    "runtimeConfig.args": "Args",
    "runtimeConfig.host": "Host",
    "runtimeConfig.profile": "Command / profile alias",
    "runtimeConfig.commandHint": "For example: npx.cmd, npx, or an absolute adapter path",
    "runtimeConfig.argsHint": "Space-separated; leave empty to use default ACP adapter args",
    "runtimeConfig.hermesHint": "For example: hermes, or a detected profile alias",
    "runtimeConfig.currentState": "Current state: {state}",
    "runtimeConfig.save": "Save and probe again",
    "runtimeConfig.cancel": "Cancel",
    "runtimeConfig.legacyPrompt": "Use legacy prompt",
    "runtimeConfig.saving": "Saving runtime configuration...",
    "runtimeConfig.saved": "Runtime configuration saved. New or restored ACP sessions will use it.",
    "runtimeConfig.failed": "Failed to read or save runtime configuration: {error}",
    "connection.title": "Connection details",
    "connection.subtitle": "This checks whether an entry can open; agents/profiles come from runtime detection.",
    "connection.detected": "Detected runtime environments",
    "connection.none": "No usable runtime environment detected yet.",
    "connection.recheck": "Recheck",
    "common.close": "Close",
  },
};

function t(key, params = {}) {
  const table = translations[languageId] || translations["zh-CN"];
  const template = table[key] || translations["zh-CN"][key] || key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
}

markdownRenderer.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const lang = token.info.trim().split(/\s+/)[0] || "";
  return renderCodeFence(lang, token.content);
};

markdownRenderer.renderer.rules.table_open = () => "<div class=\"md-table-wrap\"><table class=\"md-table\">\n";
markdownRenderer.renderer.rules.table_close = () => "</table></div>\n";

function transformOutsideCodeFences(text, transformLine) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let inFence = false;
  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      return;
    }
    output.push(inFence ? line : transformLine(line));
  });
  return output.join("\n");
}

function splitCollapsedMarkdownTableRows(line) {
  return String(line || "")
    .replace(/\|\s*(?=\|\s*:?-{3,}:?\s*\|)/g, "|\n")
    .replace(/\|\s*(?=\|[^|\n]{1,80}\|[^|\n]{0,120}\|[^|\n]{0,120}\|)/g, "|\n");
}

function normalizeRuntimeMarkdown(text) {
  return transformOutsideCodeFences(text, (line) => {
    let value = splitCollapsedMarkdownTableRows(line)
      .replace(/(\|)\s*(?=\*\*[^*\n]{1,80}\*\*[^|\n]*(?:#{1,6}\s|$))/gu, "$1\n\n")
      .replace(/([^\n#])(?=#{1,6}\s+\S)/g, "$1\n\n")
      .replace(/(#{1,6}\s*[^\n|]{1,180}?)\s*(\|)/g, "$1\n$2")
      .replace(/(^|\n)(#{1,6}\s+\d+(?:\.\d+)?\s+[^-\n]{2,50})\s*-\s*/gu, "$1$2\n\n- ")
      .replace(/([^\n])-\s*(?=\s*\*\*[^*\n]{1,40}\*\*)/gu, "$1\n- ")
      .replace(/(^|\n)-(?=\*\*)/gu, "$1- ")
      .replace(/(^|\n)---(?=\*\*)/gu, "$1---\n\n");
    if (!value.trimStart().startsWith("|") && (value.match(/\|/g) || []).length >= 2) {
      value = value.replace(/^(.{1,180}?)(\|[^|\n]+\|[^|\n]*\|.*)$/, (_, prefix, table) => `${prefix.trimEnd()}\n${table}`);
    }
    return value;
  });
}

function markdownTableCellCount(line) {
  const value = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  return value ? value.split("|").length : 0;
}

function isMarkdownTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || "").trim());
}

function hasMarkdownTable(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.some((line, index) => line.includes("|")
    && isMarkdownTableSeparator(lines[index + 1]));
}

function closeStreamingMarkdown(text) {
  let value = String(text || "");
  const fenceCount = (value.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) value += "\n```";
  const inlineTickCount = (value.match(/(?<!`)`(?!`)/g) || []).length;
  if (inlineTickCount % 2 === 1) value += "`";
  const strongCount = (value.match(/\*\*/g) || []).length;
  if (strongCount % 2 === 1) value += "**";
  const strikeCount = (value.match(/~~/g) || []).length;
  if (strikeCount % 2 === 1) value += "~~";
  return value;
}

function normalizeLooseMarkdownTables(text) {
  const lines = String(text || "").split(/\r?\n/);
  const output = [];
  let index = 0;
  let inFence = false;
  let inExistingTable = false;

  while (index < lines.length) {
    const current = lines[index];
    if (current.trim().startsWith("```")) {
      inFence = !inFence;
      inExistingTable = false;
      output.push(current);
      index += 1;
      continue;
    }
    if (inFence) {
      output.push(current);
      index += 1;
      continue;
    }
    if (!current.trim() || !current.includes("|")) {
      inExistingTable = false;
    }
    if (inExistingTable && current.includes("|") && current.trim()) {
      output.push(current);
      index += 1;
      continue;
    }
    if (isMarkdownTableSeparator(current)) {
      output.push(current);
      inExistingTable = true;
      index += 1;
      continue;
    }
    const next = lines[index + 1];
    const looksLikeTableHeader = current?.includes("|")
      && next?.includes("|")
      && !isMarkdownTableSeparator(next);

    if (!looksLikeTableHeader) {
      output.push(current);
      index += 1;
      continue;
    }

    const tableLines = [];
    while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
      tableLines.push(lines[index]);
      index += 1;
    }

    if (tableLines.length < 2) {
      output.push(...tableLines);
      continue;
    }

    const columnCount = Math.max(...tableLines.map(markdownTableCellCount));
    if (columnCount < 2) {
      output.push(...tableLines);
      continue;
    }

    output.push(tableLines[0]);
    output.push(Array.from({ length: columnCount }, () => "---").join("|"));
    output.push(...tableLines.slice(1));
  }

  return output.join("\n");
}

let mermaidRuntimePromise = null;

async function loadMermaidRuntime() {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import("mermaid").then((module) => {
      const runtime = module.default;
      runtime.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          primaryColor: "#fbf6ec",
          primaryTextColor: "#2f2a24",
          primaryBorderColor: "#c7ad82",
          lineColor: "#7b6240",
          secondaryColor: "#f3ead9",
          tertiaryColor: "#fffaf0",
        },
      });
      return runtime;
    });
  }
  return mermaidRuntimePromise;
}

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
    lane: "",
    noteKey: "provider.claude.note",
    agents: [
      {
        id: "claude-main",
        providerId: "claude",
        nameKey: "agent.main",
        subtitle: "Windows CLI",
        noteKey: "agent.claude.note",
        state: 1,
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    lane: "",
    noteKey: "provider.hermes.note",
    agents: [
      {
        id: "hermes-main",
        providerId: "hermes",
        nameKey: "agent.main",
        subtitle: "WSL Runtime",
        noteKey: "agent.hermes.note",
        state: 1,
      },
    ],
  },
  {
    id: "trae",
    name: "Trae IDE",
    lane: "",
    noteKey: "provider.trae.note",
    agents: [
      {
        id: "trae-main",
        providerId: "trae",
        nameKey: "agent.main",
        subtitle: "IDE Bridge",
        noteKey: "agent.trae.note",
        state: 1,
      },
    ],
  },
];

const LEGACY_TARGET_AGENT_KEY = "lunaagentos.currentTargetAgentId";
const CURRENT_TARGET_AGENT_KEY = "lunaagentos.currentTargetId";
const CURRENT_SESSION_KEY = "lunaagentos.currentSessionId";
const SEND_MODE_KEY = "lunaagentos.sendMode";
const FONT_SCALE_KEY = "lunaagentos.fontScale";
const LANGUAGE_KEY = "lunaagentos.language";
const HISTORY_SCHEMA_VERSION = 3;
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
const demoSceneBtn = document.getElementById("demoSceneBtn");
const languageBtn = document.getElementById("languageBtn");
const confirmDialog = document.getElementById("confirmDialog");

localStorage.removeItem(CURRENT_SESSION_KEY);

let currentTargetAgentId = localStorage.getItem(CURRENT_TARGET_AGENT_KEY) || localStorage.getItem(LEGACY_TARGET_AGENT_KEY) || "claude-main";
let currentSessionId = null;
let sessions = [];
let activeSessionIds = new Set();
let historyEntries = [];
let sessionSeq = 0;
let turnSeq = 0;
let runningSessions = 0;
let isHistoryLoading = true;
let isLaunchDemoScene = false;
let sendAsNewSession = false;
let sendMode = localStorage.getItem(SEND_MODE_KEY) || "enter";
let fontScaleId = localStorage.getItem(FONT_SCALE_KEY) || "default";
let languageId = localStorage.getItem(LANGUAGE_KEY) || "zh-CN";
let runtimeAvailability = {
  claude: { summary: "probing", configured: false, available: false, command: "" },
  hermes: { summary: "probing", configured: false, available: false, command: "" },
  trae: { summary: "planned", configured: false, available: false, command: "IDE Bridge" },
};
let runtimeInstances = [];
let hermesProfilesByInstance = {};
let demoHistoryEntries = [];
const deletedSessionIds = new Set();
const stoppedSessionIds = new Set();
const flowDetailOpenState = new Map();
const collapsedTurnIds = new Set();
const sessionLatestOnlyState = new Map();
const sessionListSectionOpenState = {
  active: true,
  archive: true,
};
let scheduledWorkspaceRenderOptions = null;
let scheduledWorkspaceRenderFrame = 0;
let scheduledWorkspaceRenderTimer = 0;
let pendingConfirmAction = null;

function allAgents() {
  const dynamicTargets = runtimeTargets();
  return runtimeInstances.length ? dynamicTargets : providers.flatMap((provider) => provider.agents);
}

function providerById(id) {
  return providers.find((provider) => provider.id === id);
}

function runtimeInstancesForProvider(providerId) {
  return runtimeInstances.filter((instance) => instance.providerId === providerId);
}

function availableRuntimeInstancesForProvider(providerId) {
  return runtimeInstancesForProvider(providerId).filter((instance) => instance.available);
}

function runtimeInstanceById(id) {
  return runtimeInstances.find((instance) => instance.id === id) || null;
}

function providerRuntimeLabel(provider, instance, availableCount) {
  if (!instance?.runtimeLabel) return provider.name;
  if (availableCount === 1 && instance.runtimeLabel === "Win") return provider.name;
  return `${provider.name} · ${instance.runtimeLabel}`;
}

function runtimeHostForInstance(instance) {
  return instance?.commandKind || instance?.host || null;
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

function targetsForRuntimeInstance(instance) {
  const provider = providerById(instance.providerId);
  if (!provider || !instance.available) return [];
  const availableCount = availableRuntimeInstancesForProvider(instance.providerId).length;
  if (instance.providerId === "claude") {
    const label = providerRuntimeLabel(provider, instance, availableCount);
    return [{
      id: instance.id,
      providerId: provider.id,
      runtimeInstanceId: instance.id,
      runtimeLabel: instance.runtimeLabel,
      runtimeHost: runtimeHostForInstance(instance),
      runtimeCommand: instance.command,
      kind: "runtime",
      name: label,
      subtitle: instance.runtimeLabel || "Runtime",
      state: 1,
      available: true,
    }];
  }
  if (instance.providerId === "hermes") {
    return (hermesProfilesByInstance[instance.id] || []).map((profile) => ({
      id: profile.id,
      providerId: "hermes",
      runtimeInstanceId: instance.id,
      runtimeLabel: instance.runtimeLabel,
      runtimeHost: runtimeHostForInstance(instance),
      runtimeCommand: instance.command,
      kind: "profile",
      name: profile.displayName,
      subtitle: profile.subtitle || `${instance.runtimeLabel || "Runtime"} Profile`,
      note: profile.note || "Hermes profile",
      state: typeof profile.state === "number" ? profile.state : 1,
      available: true,
      profileName: profile.profileName,
      model: profile.model,
      gateway: profile.gateway,
      alias: profile.alias,
      profileAlias: profile.alias,
      profileExecutable: profile.alias || profile.profileName || null,
      path: profile.path,
      profilePath: profile.path,
      skillCount: profile.skillCount,
      hasEnv: profile.hasEnv,
      hasSoul: profile.hasSoul,
      isDefault: Boolean(profile.isDefault),
    }));
  }
  return [];
}

function runtimeTargets() {
  return runtimeInstances.flatMap(targetsForRuntimeInstance);
}

function ensureCurrentTargetAgentExists() {
  if (currentTargetAgentId && agentById(currentTargetAgentId)) return;
  if (agentById(DEFAULT_HERMES_AGENT_ID)) {
    saveCurrentTargetAgent(DEFAULT_HERMES_AGENT_ID);
    return;
  }
  if (agentById("claude-win")) {
    saveCurrentTargetAgent("claude-win");
    return;
  }
  const fallbackAgent = allAgents()[0];
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
  if (managedByRuntimeProbe && !staticAgent.isArchivedAgent && !staticAgent.id.includes("-demo-")) return null;
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

function displayProviderNote(provider) {
  return provider?.noteKey ? t(provider.noteKey, provider.noteParams || {}) : provider?.note || "";
}

function currentTargetProvider() {
  return providerForAgent(currentTargetAgentId);
}

function acpCommandsForProvider(providerId) {
  return acpRuntimeCommands[providerId] || null;
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
    return runtimeTargets().some((target) => target.providerId === providerId);
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

function isArchivedSessionListItem(item) {
  return item.runtimeState === "archived";
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

function applyStaticTranslations() {
  document.documentElement.lang = languageId;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.title = languageId === "en-US" ? "LunaAgentOS Console" : "LunaAgentOS 控制台";
  if (providerManagerBtn) providerManagerBtn.textContent = t("common.manage");
  if (languageBtn) languageBtn.textContent = t("topbar.language");
  applyFontScale();
  updateActionLabels();
  updateSendModeLabel();
  updatePromptPlaceholder();
}

function toggleLanguage() {
  languageId = languageId === "zh-CN" ? "en-US" : "zh-CN";
  localStorage.setItem(LANGUAGE_KEY, languageId);
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

function openConfirmDialog({ title, message, confirmLabel = "删除", onConfirm }) {
  if (!confirmDialog) return;
  pendingConfirmAction = onConfirm;
  confirmDialog.hidden = false;
  confirmDialog.innerHTML = `
    <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
      <div class="confirm-dialog-header">
        <span class="confirm-dialog-icon" aria-hidden="true">!</span>
        <h3 id="confirmDialogTitle">${escapeHtml(title)}</h3>
        <button type="button" class="confirm-dialog-close" aria-label="关闭">×</button>
      </div>
      <p class="confirm-dialog-message">${escapeHtml(message)}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="mini-btn confirm-dialog-cancel">取消</button>
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
  sendBtn.textContent = isLaunchDemoScene ? t("composer.demo") : t("composer.send");
  sendBtn.disabled = isLaunchDemoScene;
  newSessionToggle.disabled = isLaunchDemoScene;
  newSessionToggle.classList.toggle("is-active", sendAsNewSession);
  newSessionToggle.setAttribute("aria-pressed", String(sendAsNewSession));
  if (demoSceneBtn) demoSceneBtn.textContent = isLaunchDemoScene ? t("topbar.clearDemo") : t("topbar.demo");
}

function updatePromptPlaceholder() {
  const agent = currentTargetAgent();
  promptBox.placeholder = agent
    ? t("composer.placeholderTarget", { target: targetDisplayName(agent) })
    : t("composer.placeholderNoTarget");
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
  currentSessionId = sessionId || null;
  localStorage.removeItem(CURRENT_SESSION_KEY);
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
    const claudeCommand = window.prompt("Claude adapter command（留空使用默认 npx/npx.cmd）", current?.claudeCommand || "");
    if (claudeCommand === null) return;
    const claudeArgs = window.prompt("Claude adapter args（空格分隔；留空使用默认 -y @agentclientprotocol/claude-agent-acp）", (current?.claudeArgs || []).join(" "));
    if (claudeArgs === null) return;
    const hermesHost = window.prompt("Hermes host：wsl 或 native", current?.hermesHost || "wsl");
    if (hermesHost === null) return;
    const hermesCommand = window.prompt("Hermes executable/profile alias（留空使用 hermes 或已探测 profile）", current?.hermesCommand || "");
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
    setAppNotice("Runtime 配置已保存。后续新建/恢复 ACP 会话会使用该配置。");
    await refreshRuntimeProbe();
  } catch (error) {
    console.error(error);
    setAppNotice(`Runtime 配置读取或保存失败：${formatBackendError(error)}`, "error");
  }
}

async function openProviderManager(providerId = currentTargetProvider()?.id || "claude") {
  if (!confirmDialog) {
    await openProviderManagerPrompt();
    return;
  }
  try {
    const selectedProviderId = providerId === "hermes" ? "hermes" : "claude";
    const selectedAvailability = providerAvailability(selectedProviderId);
    const selectedState = providerAvailabilityLabel(selectedAvailability.summary);
    const selectedStateClass = stateClasses[PROVIDER_AVAILABILITY_STATES[selectedAvailability.summary]?.state] || "state-idle";
    const isClaude = selectedProviderId === "claude";
    const title = isClaude ? t("runtimeConfig.claudeTitle") : t("runtimeConfig.hermesTitle");
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
            ${instance.detail ? `<small>${escapeHtml(instance.detail)}</small>` : ""}
            ${instance.version ? `<small>${escapeHtml(instance.version)}</small>` : ""}
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
            <span>${escapeHtml(runtimeConnectionNote(providerById(selectedProviderId) || { id: selectedProviderId, name: title }, instances))}</span>
          </aside>
          <section class="runtime-config-section">
            <h4>${t("connection.detected")}</h4>
            <div class="connection-instance-list">${instanceMarkup}</div>
          </section>
        </div>
        <div class="confirm-dialog-actions runtime-config-actions">
          <button type="button" class="confirm-dialog-cancel runtime-config-close">${t("common.close")}</button>
          <button type="button" class="mini-btn ghost-btn runtime-config-legacy">${t("runtimeConfig.legacyPrompt")}</button>
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
    confirmDialog.querySelector(".runtime-config-dialog")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const saveButton = event.currentTarget.querySelector(".runtime-config-save");
      saveButton.disabled = true;
      setAppNotice("正在重新检查连接...", "busy");
      try {
        await refreshRuntimeProbe();
        if (selectedProviderId === "hermes") await loadHermesProfiles();
        closeConfirmDialog();
        setAppNotice("连接检查已完成。");
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

function showProviderAgents(provider) {
  const names = provider.agents.map((agent) => displayAgentName(agent)).join("、");
  setAppNotice(`${provider.name} 当前已登记的 Agent：${names}。`);
}

async function refreshRuntimeProbe() {
  try {
    const result = await invoke("runtime_probe");
    const next = { ...runtimeAvailability };
    (result?.providers || []).forEach((item) => {
      next[item.providerId] = item;
    });
    runtimeAvailability = next;
    runtimeInstances = Array.isArray(result?.instances) ? result.instances : [];
    hermesProfilesByInstance = Object.fromEntries(
      Object.entries(hermesProfilesByInstance).filter(([instanceId]) =>
        runtimeInstances.some((instance) => instance.id === instanceId && instance.available),
      ),
    );
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspaceStatus();
    return result;
  } catch (error) {
    console.error(error);
    setAppNotice(`Runtime 探测失败：${formatBackendError(error)}`, "error");
    return null;
  }
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
  updatePromptPlaceholder();
  if (agent && provider) {
    renderWorkspaceStatus();
    setAppNotice(`已切换到 ${targetDisplayName(agent)}。`);
  }
  renderProviders();
  renderWorkspace();
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
  const selected = target.id === currentTargetAgentId;
  return `
    <div class="agent-entry ${selected ? "is-main-agent" : "is-selectable"}" data-agent-id="${target.id}">
      <div class="agent-entry-top">
        <strong>${escapeHtml(displayAgentName(target))}</strong>
      </div>
      ${target.subtitle ? `<div class="agent-entry-sub">${escapeHtml(target.subtitle)}</div>` : ""}
      ${selected ? "" : `<div class="agent-entry-actions"><span class="agent-action-hint">${t("provider.setTarget")}</span></div>`}
    </div>
  `;
}

function renderRuntimeInstanceBlock(provider, instance, targets, availableCount) {
  const label = providerRuntimeLabel(provider, instance, availableCount);
  const state = instance.available ? 1 : 9;
  const canSelectRuntime = provider.id === "claude" && targets.length === 1;
  if (canSelectRuntime) return renderRuntimeTarget(targets[0]);
  return `
    <div class="runtime-instance-block ${instance.available ? "is-available" : "is-unavailable"}">
      <div class="runtime-instance-head">
        <strong>${escapeHtml(label)}</strong>
        <span class="state-pill ${stateClasses[state] || "state-idle"}">${instance.available ? t("provider.available") : t("provider.notConnected")}</span>
      </div>
      ${targets.length
        ? `<div class="provider-agents is-runtime-targets">${targets.map(renderRuntimeTarget).join("")}</div>`
        : `<div class="runtime-instance-empty">
            <span>${instance.available ? t("provider.noTargets") : t("provider.noRuntime")}</span>
            <button type="button" class="mini-btn ghost-btn provider-manage-btn" data-provider-id="${provider.id}">${t("common.fixConnection")}</button>
          </div>`}
    </div>
  `;
}

function renderProviders() {
  ensureCurrentTargetAgentExists();
  agentList.innerHTML = "";

  providers.forEach((provider) => {
    const group = document.createElement("section");
    group.className = "provider-group";
    const aggregateState = providerState(provider);
    const availability = providerAvailability(provider.id);
    const availabilityLabel = providerAvailabilityLabel(availability.summary);
    const instances = runtimeInstancesForProvider(provider.id);
    const availableCount = availableRuntimeInstancesForProvider(provider.id).length;
    const dynamicTargets = instances.flatMap(targetsForRuntimeInstance);
    const shouldUseDynamic = instances.length > 0;
    const availabilityDetail = shouldUseDynamic
      ? runtimeConnectionNote(provider, instances)
      : (availability.command ? `${availabilityLabel} · ${availability.command}` : availabilityLabel);
    const targetMarkup = shouldUseDynamic
      ? instances.map((instance) => renderRuntimeInstanceBlock(
        provider,
        instance,
        targetsForRuntimeInstance(instance),
        availableCount,
      )).join("")
      : provider.agents.map((agent) => `
        <div class="agent-entry ${agent.id === currentTargetAgentId ? "is-main-agent" : "is-selectable"}" data-agent-id="${agent.id}">
          <div class="agent-entry-top">
            <strong>${displayAgentName(agent)}</strong>
          </div>
          <div class="agent-entry-sub">${agent.subtitle}</div>
          ${agent.id === currentTargetAgentId
            ? ""
            : `<div class="agent-entry-actions"><span class="agent-action-hint">${t("provider.setTarget")}</span></div>`}
        </div>
      `).join("");

    group.innerHTML = `
      <div class="provider-header">
        <div>
          <div class="provider-title-row">
            <strong>${provider.name}</strong>
            <span class="state-pill provider-state-pill ${stateClasses[aggregateState] || "state-idle"}">${availabilityLabel}</span>
          </div>
          ${provider.lane ? `<div class="provider-lane">${provider.lane}</div>` : ""}
        </div>
        <button type="button" class="mini-btn ghost-btn provider-manage-btn" data-provider-id="${provider.id}">${availability.available ? t("common.manage") : t("common.fixConnection")}</button>
      </div>
      <p class="caption provider-note">${displayProviderNote(provider)}</p>
      <p class="caption provider-runtime-note">${escapeHtml(availabilityDetail)}</p>
      <div class="${shouldUseDynamic ? "runtime-instance-list" : "provider-agents"}">
        ${targetMarkup || `<div class="runtime-instance-empty">${provider.id === "hermes" ? t("provider.noHermesRuntime") : t("provider.noRuntime")}</div>`}
      </div>
    `;

    agentList.appendChild(group);
  });

  agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openProviderManager(button.dataset.providerId);
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
  hermesProvider.note = null;
  hermesProvider.noteKey = "provider.hermes.loadedNote";
  hermesProvider.noteParams = { count: profiles.length };
  if (isLaunchDemoScene) {
    ensureLaunchDemoHermesAgent();
    currentTargetAgentId = "hermes-demo-ailearning";
  }
  ensureCurrentTargetAgentExists();
  renderProviders();
  renderWorkspace();
}

function applyHermesProfilesForInstance(runtimeInstanceId, profiles) {
  hermesProfilesByInstance = {
    ...hermesProfilesByInstance,
    [runtimeInstanceId]: Array.isArray(profiles) ? profiles : [],
  };
  const count = Object.values(hermesProfilesByInstance).reduce((sum, items) => sum + items.length, 0);
  const hermesProvider = providerById("hermes");
  if (hermesProvider && count > 0) {
    hermesProvider.note = null;
    hermesProvider.noteKey = "provider.hermes.loadedNote";
    hermesProvider.noteParams = { count };
  }
}

async function loadHermesProfiles(runtimeInstanceIds = null) {
  const instances = (runtimeInstanceIds || availableRuntimeInstancesForProvider("hermes").map((instance) => instance.id))
    .map(runtimeInstanceById)
    .filter(Boolean)
    .filter((instance) => instance.available);
  if (!instances.length) return;
  try {
    let loaded = 0;
    for (const instance of instances) {
      const profiles = await invoke("runtime_hermes_profiles", { runtimeInstanceId: instance.id });
      applyHermesProfilesForInstance(instance.id, profiles);
      loaded += Array.isArray(profiles) ? profiles.length : 0;
    }
    ensureCurrentTargetAgentExists();
    renderProviders();
    renderWorkspace();
    if (!loaded) setAppNotice("未探测到可用的 Hermes profile。");
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
    runtimeState: "live",
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
  sessions = [session, ...sessions];
  markSessionActive(session.id);
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

function prependHermesStartupNoticeIfNeeded(session, turn) {
  if (session.providerId !== "hermes") return;
  if (session.acpStartupNoticeShown || session.acpSessionId) return;
  const profileName = session.profileName || session.agentName;
  const message = `Hermes profile ${profileName} ${HERMES_ACP_STARTUP_NOTICE}`;
  session.acpStartupNoticeShown = true;
  if (!turn.logs.includes(message)) {
    turn.logs = [message, ...turn.logs];
  }
}

function demoTimestamp(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function createDemoTurn(id, task, state, thoughts, finalResponse, logs, minutesAgo, meta = {}) {
  return {
    id,
    task,
    state,
    thoughts,
    outputs: finalResponse ? [finalResponse] : [],
    finalResponse,
    logs,
    createdAt: demoTimestamp(minutesAgo),
    meta,
  };
}

function ensureLaunchDemoHermesAgent() {
  const hermesProvider = providerById("hermes");
  if (!hermesProvider) return null;
  const existing = agentById("hermes-demo-ailearning");
  if (existing) return existing;
  const agent = {
    id: "hermes-demo-ailearning",
    providerId: "hermes",
    name: "ailearning",
    subtitle: "WSL Profile · Gateway",
    note: "用于展示 Hermes ACP 过程流的演示 profile。",
    state: 3,
    profileName: "ailearning",
    model: "MiniMax M2",
    gateway: "Gateway API",
    alias: "ailearning",
    profileAlias: "ailearning",
    profileExecutable: "ailearning",
    skillCount: 4,
    hasSoul: true,
  };
  hermesProvider.agents.push(agent);
  return agent;
}

function removeLaunchDemoHermesAgent() {
  const hermesProvider = providerById("hermes");
  if (!hermesProvider) return;
  hermesProvider.agents = hermesProvider.agents.filter((agent) => agent.id !== "hermes-demo-ailearning");
}

function buildLaunchDemoSessions() {
  const hermesMeta = {
    profileName: "ailearning",
    profileAlias: "ailearning",
    profileExecutable: "ailearning",
    profileModel: "MiniMax M2",
    gateway: "Gateway API",
    skillCount: 4,
    hasSoul: true,
  };
  const claudeTurn = createDemoTurn(
    "demo-turn-claude-review",
    "Audit the LunaAgentOS desktop shell and explain what should be visible in the first GitHub launch screenshot.",
    5,
    [
      "I will treat the app as a runtime workspace rather than a chat UI. The screenshot should prove heterogeneous entries, persistent sessions, live process visibility, and local history in one glance.",
    ],
    "## Launch screenshot checklist\n\n| Surface | What it proves | Status |\n|---|---|---|\n| Agent Fleet | Claude Code and Hermes are real external entries | Ready |\n| Runtime Session Card | Output, thought stream, runtime stream, and final response live together | Ready |\n| Session List | Live sessions and archived sessions have separate lifecycle meaning | Ready |\n\n```mermaid\nflowchart LR\n  Fleet[Agent Fleet] --> Cards[Runtime Session Cards]\n  Cards --> History[Local JSON History]\n```\n\nThe screenshot should make LunaAgentOS feel like a control layer, not another chat wrapper.",
    [
      "Parsed workspace structure: desktop-shell/src/main.js, styles.css, src-tauri/src/lib.rs",
      "Detected capability: session cards, copy transcript, fullscreen, live/archived lifecycle",
      "Saved launch summary into local session history",
    ],
    18,
  );
  const hermesTurn = createDemoTurn(
    "demo-turn-hermes-live",
    "Use Hermes to inspect the repo positioning and keep the slow runtime process visible.",
    3,
    [
      "Thinking through product positioning: LunaAgentOS should not claim to replace Claude Code or Hermes. It should present itself as the neutral desktop control layer above them.",
      "The key difference from a normal chat UI is process observability: thought, tool, plan, usage, and final response remain attached to the session card.",
    ],
    "Working on positioning notes…\n\n- Keep the Stage 1 boundary honest\n- Show Claude Code + Hermes in the same workspace\n- Treat each card as a persistent Runtime Session Surface\n- Keep slow Hermes work visible instead of hiding it behind a spinner",
    [
      "plan: compare amux / Goose / Fusion positioning",
      "tool: read docs/competitive-positioning.md",
      "usage: input 8.4k · output 1.2k · total 9.6k",
      "session/update: agent_message_chunk streamed into card",
    ],
    7,
    { hermesProfile: hermesMeta },
  );
  return [
    {
      id: "demo-session-hermes-live",
      providerId: "hermes",
      providerName: "Hermes",
      agentId: "hermes-demo-ailearning",
      agentName: "Hermes / ailearning",
      task: hermesTurn.task,
      state: 3,
      runtimeState: "live",
      turns: [hermesTurn],
      createdAt: demoTimestamp(7),
      fullscreen: false,
      acpSessionId: null,
      profileName: hermesMeta.profileName,
      profileAlias: hermesMeta.profileAlias,
      profileExecutable: hermesMeta.profileExecutable,
      profileModel: hermesMeta.profileModel,
      gateway: hermesMeta.gateway,
      skillCount: hermesMeta.skillCount,
      hasSoul: hermesMeta.hasSoul,
    },
    {
      id: "demo-session-claude-review",
      providerId: "claude",
      providerName: "Claude Code",
      agentId: "claude-main",
      agentName: "Claude Code / 主会话",
      task: claudeTurn.task,
      state: 5,
      runtimeState: "live",
      turns: [claudeTurn],
      createdAt: demoTimestamp(18),
      fullscreen: false,
      acpSessionId: null,
    },
  ];
}

function buildLaunchDemoHistoryEntries() {
  const archivedTurn = createDemoTurn(
    "demo-turn-archive-roadmap",
    "Summarize Stage 1 boundary and next launch risks.",
    5,
    ["Stage 1 is a minimal heterogeneous console. Do not expand into orchestration before the first public version is understandable."],
    "Stage 1 is enough for a first GitHub launch candidate when the repo clearly shows: real entries, session cards, process visibility, local history, and honest limitations.",
    ["Loaded from local JSON archive", "Runtime is not attached; transcript remains readable"],
    180,
  );
  return [{
    schema_version: HISTORY_SCHEMA_VERSION,
    id: "demo-history-roadmap",
    date: demoTimestamp(180).slice(0, 10),
    created_at: archivedTurn.createdAt,
    provider_id: "claude",
    provider_name: "Claude Code",
    agent_id: "claude-main",
    agent_name: "Claude Code / 主会话",
    session_id: "demo-session-archive-roadmap",
    acp_session_id: null,
    task: archivedTurn.task,
    status: "DONE",
    summary: archivedTurn.finalResponse,
    turn: archivedTurn,
  }];
}

function activateLaunchDemoScene() {
  ensureLaunchDemoHermesAgent();
  isLaunchDemoScene = true;
  isHistoryLoading = false;
  demoHistoryEntries = buildLaunchDemoHistoryEntries();
  sessions = [
    ...buildLaunchDemoSessions(),
    ...sessions.filter((session) => !session.id.startsWith("demo-session-")),
  ];
  currentTargetAgentId = "hermes-demo-ailearning";
  currentSessionId = "demo-session-hermes-live";
  activeSessionIds = new Set([...activeSessionIds, "demo-session-hermes-live", "demo-session-claude-review"]);
  ["demo-turn-hermes-live:thoughts", "demo-turn-hermes-live:logs", "demo-turn-claude-review:logs"].forEach((key) => {
    flowDetailOpenState.set(key, true);
  });
  document.body.classList.add("is-launch-demo");
  renderProviders();
  renderWorkspace({ scrollSessionId: "demo-session-hermes-live" });
  renderHistory();
  updateActionLabels();
  setAppNotice("已载入 GitHub 首发演示场景：Claude + Hermes + 活跃会话/归档会话。");
}

function isDemoSession(session) {
  return session.id.startsWith("demo-session-");
}

function leaveLaunchDemoScene() {
  isLaunchDemoScene = false;
  demoHistoryEntries = [];
  sessions = sessions.filter((session) => !isDemoSession(session));
  activeSessionIds = new Set([...activeSessionIds].filter((sessionId) => !sessionId.startsWith("demo-session-")));
  if (currentSessionId?.startsWith("demo-session-")) currentSessionId = null;
  if (currentTargetAgentId === "hermes-demo-ailearning") currentTargetAgentId = "claude-main";
  removeLaunchDemoHermesAgent();
  ensureCurrentTargetAgentExists();
  document.body.classList.remove("is-launch-demo");
  renderProviders();
  renderWorkspace();
  renderHistory();
  updateActionLabels();
  setAppNotice("已清除首发演示场景，恢复真实工作台。");
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
  if (deletedSessionIds.has(sessionId) || stoppedSessionIds.has(sessionId)) return;
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

  scheduleWorkspaceRender({ scrollSessionId: session.id, preserveDeckScroll: true }, STREAM_RENDER_INTERVAL_MS);
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
  const countedSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
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
  const normalized = normalizeLooseMarkdownTables(normalizeRuntimeMarkdown(text));
  const html = markdownRenderer.render(normalized);
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel"],
  });
}

function renderCodeFence(lang, code) {
  const normalizedLang = lang.trim().toLowerCase();
  if (normalizedLang === "mermaid") {
    return `
      <div class="md-diagram-block">
        <div class="md-code-toolbar">
          <span class="md-code-lang">mermaid</span>
          <button type="button" class="mini-btn ghost-btn md-code-copy-btn">${t("markdown.copySource")}</button>
        </div>
        <div class="md-diagram-render" aria-label="${t("markdown.diagramPreview")}">
          <span class="caption">${t("markdown.diagramRendering")}</span>
        </div>
        <div class="md-diagram-fallback">
          <strong>${t("markdown.diagramSource")}</strong>
          <p>${t("markdown.diagramFallback")}</p>
        </div>
        <pre class="md-code"><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  }
  return `
    <div class="md-code-block">
      <div class="md-code-toolbar">
        ${lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : "<span></span>"}
        <button type="button" class="mini-btn ghost-btn md-code-copy-btn">${t("markdown.copyCode")}</button>
      </div>
      <pre class="md-code"><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

async function renderMermaidDiagrams(root = sessionDeck) {
  const blocks = [...root.querySelectorAll(".md-diagram-block:not([data-rendered])")];
  if (!blocks.length) return;
  const mermaid = await loadMermaidRuntime();
  for (const [index, block] of blocks.entries()) {
    const source = block.querySelector("code")?.textContent || "";
    const target = block.querySelector(".md-diagram-render");
    if (!source.trim() || !target) continue;
    try {
      const id = `luna-mermaid-${Date.now()}-${index}`;
      const { svg } = await mermaid.render(id, source);
      target.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      block.dataset.rendered = "true";
      block.classList.add("is-rendered");
    } catch (error) {
      console.error(error);
      target.innerHTML = `<span class="caption">${t("markdown.diagramFailed")}</span>`;
      block.dataset.rendered = "failed";
      block.classList.add("is-render-failed");
    }
  }
}

function sessionCardStats(session) {
  const thoughtCount = session.turns.reduce((count, turn) => count + turn.thoughts.length, 0);
  const logCount = session.turns.reduce((count, turn) => count + turn.logs.length, 0);
  const outputCount = session.turns.filter((turn) => turnResponseText(turn)).length;
  return [
    thoughtCount ? { key: "thoughts", label: t("session.thoughts", { count: thoughtCount }) } : null,
    logCount ? { key: "logs", label: t("session.logs", { count: logCount }) } : null,
    outputCount ? { key: "responses", label: t("session.responses", { count: outputCount }) } : null,
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
    dismiss: `<path d="M12 4v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 20h14"></path>`,
    archive: `<path d="M4 7h16"></path><path d="M6 7l1.2 13h9.6L18 7"></path><path d="M9 11h6"></path>`,
    stop: `<rect x="7" y="7" width="10" height="10" rx="1.5"></rect>`,
    delete: `<path d="M4 7h16"></path><path d="M10 11v5"></path><path d="M14 11v5"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path>`,
    copy: `<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path>`,
    latest: `<circle cx="12" cy="12" r="4"></circle><path d="M12 3v2"></path><path d="M12 19v2"></path><path d="M3 12h2"></path><path d="M19 12h2"></path>`,
    all: `<path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path>`,
    collapse: `<path d="M7 15l5-5 5 5"></path><path d="M5 20h14"></path>`,
    expand: `<path d="M7 9l5 5 5-5"></path><path d="M5 4h14"></path>`,
    latestScroll: `<path d="M12 4v13"></path><path d="m7 12 5 5 5-5"></path><path d="M5 20h14"></path>`,
    fullscreen: `<path d="M8 4H4v4"></path><path d="M16 4h4v4"></path><path d="M20 16v4h-4"></path><path d="M4 16v4h4"></path>`,
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
  if (!compact) return "本轮内容已折叠。";
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
  setAppNotice(shouldExpand ? "已展开当前会话全部轮次。" : "已折叠当前会话全部轮次。");
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
  const streaming = executingSessionStates.has(turn.state);
  const waiting = streaming && !turn.finalResponse;
  const rawResponseText = turnResponseText(turn);
  const responseText = rawResponseText || t("turn.waiting");
  const thoughtDetailKey = `${turn.id}:thoughts`;
  const logDetailKey = `${turn.id}:logs`;
  const collapsed = collapsedTurnIds.has(turn.id);
  const turnToggleLabel = collapsed ? t("action.expandTurn") : t("action.collapseTurn");
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
            <p>${escapeHtml(turn.task)}<span class="user-inline-label">：User</span></p>
          </div>
          ${turn.thoughts.length
            ? `
              <details class="terminal-detail" data-detail-key="${escapeHtml(thoughtDetailKey)}" ${detailOpenAttribute(thoughtDetailKey, waiting)}>
                <summary>${t("turn.thoughts", { count: turn.thoughts.length })}</summary>
                <div class="terminal-pre rich-text">${renderRichText(turn.thoughts.join("\n\n"))}</div>
              </details>
            `
            : ""}
          <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
            <div class="terminal-label">assistant</div>
            ${renderAssistantResponse(responseText, streaming ? "streaming" : "final")}
          </div>
          ${turn.logs.length
            ? `
              <details class="terminal-detail log-block" data-detail-key="${escapeHtml(logDetailKey)}" ${detailOpenAttribute(logDetailKey, waiting)}>
                <summary>${t("turn.logs", { count: turn.logs.length })}</summary>
                <div class="terminal-pre rich-text">${renderRichText(turn.logs.join("\n"))}</div>
              </details>
            `
            : ""}
        `}
    </section>
  `;
}

function renderSessionCard(session) {
  const runtimeState = sessionRuntimeState(session);
  const isActiveReceiver = currentSessionId === session.id;
  const isWaiting = isSessionExecuting(session);
  const isRestoring = runtimeState === "restoring";
  const managementDisabled = isRestoring ? "disabled" : "";
  const profileMeta = session.providerId === "hermes"
    ? [session.profileName, session.profileModel].filter(Boolean).join(" · ")
    : "";
  const shouldShowRuntimeState = runtimeState !== "live";
  const stats = sessionCardStats(session);
  const latestOnly = isSessionLatestOnly(session);
  const hasFlowDetails = flowDetailEntriesForSession(session).length > 0;
  const flowsOpen = areSessionFlowDetailsOpen(session);
  const turnsCollapsed = areSessionTurnsCollapsed(session);
  const turnEntries = session.turns.map((turn, index) => ({ turn, index }));
  const visibleTurnEntries = latestOnly && turnEntries.length > 1 ? turnEntries.slice(-1) : turnEntries;
  const hiddenTurnCount = turnEntries.length - visibleTurnEntries.length;
  const managementTitleSuffix = isRestoring ? t("action.restoringSuffix") : "";
  const runtimeLabel = runtimeStateLabel(runtimeState);
  const turnToggleLabel = turnsCollapsed ? t("action.expandAllTurns") : t("action.collapseAllTurns");
  const latestOnlyLabel = latestOnly ? t("action.showAllTurns") : t("action.latestOnly");
  const flowToggleLabel = flowsOpen ? t("action.collapseFlows") : t("action.expandFlows");
  const fullscreenLabel = session.fullscreen ? t("action.exitFullscreen") : t("action.enterFullscreen");
  return `
    <article class="session-card ${session.fullscreen ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}" tabindex="0" aria-label="${escapeHtml(t("session.ariaSwitch", { task: session.task }))}" ${isActiveReceiver ? "aria-current=\"true\"" : ""}>
      <div class="session-card-header">
        <div class="session-identity-row">
          <div class="session-agent-title">
            <strong>${escapeHtml(session.agentName)}</strong>
            ${isActiveReceiver ? `<span class="active-receiver-banner">${t("session.current")}</span>` : ""}
          </div>
          ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
        </div>
        <div class="session-control-row">
          <div class="session-status-cluster">
            ${shouldShowRuntimeState ? `<span class="runtime-pill ${runtimeStateClasses[runtimeState] || "runtime-archived"} ${isWaiting ? "is-busy" : ""}" aria-label="${escapeHtml(t("session.statusAria", { state: runtimeLabel }))}">${escapeHtml(runtimeLabel)}</span>` : ""}
            <div class="session-card-stats" aria-label="${t("session.statsAria")}">
              <button type="button" class="session-stat-pill session-turns-toggle-btn ${turnsCollapsed ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${turnsCollapsed ? "true" : "false"}" title="${turnToggleLabel}" aria-label="${turnToggleLabel}" ${session.turns.length ? "" : "disabled"}>${t("session.turns", { count: session.turns.length })}</button>
              ${stats.map((item) => `<span class="session-stat-pill" data-stat-key="${escapeHtml(item.key)}">${escapeHtml(item.label)}</span>`).join("")}
            </div>
          </div>
          <div class="session-card-actions">
            ${isWaiting && runtimeState === "live" ? `<button type="button" class="mini-btn ghost-btn session-action-btn session-stop-btn" data-session-id="${session.id}" title="${t("action.stop")}" aria-label="${t("action.stop")}">${renderSessionActionIcon("stop")}</button>` : ""}
            <button type="button" class="mini-btn ghost-btn session-action-btn session-dismiss-btn" data-session-id="${session.id}" title="${t("action.dismiss")}${managementTitleSuffix}" aria-label="${t("action.dismiss")}" ${managementDisabled}>${renderSessionActionIcon("dismiss")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn session-archive-btn" data-session-id="${session.id}" title="${t("action.archive")}${managementTitleSuffix}" aria-label="${t("action.archive")}" ${managementDisabled}>${renderSessionActionIcon("archive")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="${t("action.delete")}${managementTitleSuffix}" aria-label="${t("action.delete")}" ${managementDisabled}>${renderSessionActionIcon("delete")}</button>
            ${canRestoreSession(session) ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">${t("session.restoreRetry")}</button>` : ""}
            <div class="session-tool-group" role="group" aria-label="${t("session.actionsAria")}">
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="${t("action.copySession")}" aria-label="${t("action.copySession")}" ${session.turns.length ? "" : "disabled"}>${renderSessionActionIcon("copy")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnlyLabel}" aria-label="${latestOnlyLabel}" ${session.turns.length > 1 ? "" : "disabled"}>${renderSessionActionIcon(latestOnly ? "all" : "latest")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-toggle-flows-btn ${flowsOpen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${flowsOpen ? "true" : "false"}" title="${flowToggleLabel}" aria-label="${flowToggleLabel}" ${hasFlowDetails ? "" : "disabled"}>${renderSessionActionIcon(flowsOpen ? "collapse" : "expand")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="${t("action.scrollLatest")}" aria-label="${t("action.scrollLatest")}">${renderSessionActionIcon("latestScroll")}</button>
              <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-fullscreen-btn ${session.fullscreen ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${session.fullscreen ? "true" : "false"}" title="${fullscreenLabel}" aria-label="${fullscreenLabel}">
                ${renderSessionActionIcon(session.fullscreen ? "fullscreenExit" : "fullscreen")}
              </button>
            </div>
          </div>
        </div>
        <div class="caption session-task">${escapeHtml(t("session.task", { task: session.task }))}</div>
      </div>
      <div class="session-card-body">
        ${session.turns.length
          ? `${hiddenTurnCount ? `<div class="session-hidden-turns">${t("session.hiddenTurns", { count: hiddenTurnCount })}</div>` : ""}${visibleTurnEntries.map(({ turn, index }) => renderTurn(turn, index)).join("")}<div class="session-latest-anchor">${isWaiting ? "streaming..." : "latest"}</div>`
          : `<p class='flow-empty'>${t("session.noMessages")}</p>`}
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
  sessionDeck.querySelectorAll(".session-archive-btn").forEach((button) => {
    button.addEventListener("click", () => archiveLiveSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-stop-btn").forEach((button) => {
    button.addEventListener("click", () => stopSession(button.dataset.sessionId));
  });
  sessionDeck.querySelectorAll(".session-delete-btn").forEach((button) => {
    button.addEventListener("click", () => requestDeleteConfirmation(button.dataset.sessionId));
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
  sessionDeck.querySelectorAll(".session-turns-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => toggleSessionTurnsCollapsed(button.dataset.sessionId));
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
  sessionDeck.querySelectorAll(".turn-collapse-btn").forEach((button) => {
    button.addEventListener("click", () => toggleTurnCollapsed(button.dataset.turnId));
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
      const code = button.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
      if (!code) {
        setAppNotice("当前代码块为空。", "busy");
        return;
      }
      const copied = await copyTextToClipboard(code);
      setAppNotice(copied ? "已复制代码块。" : "复制失败，请手动选择代码。", copied ? "muted" : "error");
    });
  });
}

function activateWorkspaceSession(sessionId, options = {}) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  saveCurrentTargetAgent(session.agentId);
  saveCurrentSession(session.id);
  if (canSendToSession(session)) markSessionActive(session.id);
  renderProviders();
  renderWorkspace({ focusSessionId: options.focusWorkspace ? session.id : null });
  renderHistory({ scrollSessionId: session.id });
  const runtimeState = sessionRuntimeState(session);
  setAppNotice(canSendToSession(session)
    ? `当前工作 session 已切换到：${session.task}`
    : runtimeState === "restoring"
      ? "已定位到正在重连的会话，请稍等。"
      : "已切换到只读会话；继续发送会创建新的 live 会话或需要先恢复。");
}

async function shutdownRuntimeSession(session) {
  const commands = acpCommandsForProvider(session.providerId);
  if (!commands) return false;
  return invoke(commands.shutdown, { runtimeSessionId: session.id });
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
  if (!turn.finalResponse || turn.finalResponse === "正在等待运行时返回内容...") {
    turn.finalResponse = "会话已停止。";
  }
  turn.logs = ["用户已停止该会话运行。", ...turn.logs];
  session.state = 6;
  return turn;
}

async function archiveLiveSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const shouldMarkStopped = isSessionExecuting(session);
  if (shouldMarkStopped) stoppedSessionIds.add(sessionId);
  try {
    await shutdownRuntimeSession(session);
  } catch (error) {
    console.error(error);
  }
  const stoppedTurn = shouldMarkStopped ? markSessionStopped(session) : null;
  session.runtimeState = "archived";
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
  setAppNotice(`${session.agentName} 已归档，ACP runtime 已释放。`);
}

async function detachRuntimeKeepActive(session) {
  try {
    await shutdownRuntimeSession(session);
  } catch (error) {
    console.error(error);
  }
  session.runtimeState = "live";
}

async function stopSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const runtimeState = sessionRuntimeState(session);
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，暂不支持停止。", "busy");
    return;
  }
  if (runtimeState !== "live") {
    setAppNotice("该会话当前没有可停止的 live runtime。", "busy");
    return;
  }
  stoppedSessionIds.add(sessionId);
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
  setAppNotice(`${session.agentName} 已停止运行，仍保留为活跃会话。`);
}

function removeSessionFromWorkspace(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  if (scheduledWorkspaceRenderOptions?.scrollSessionId === sessionId) {
    scheduledWorkspaceRenderOptions = { ...scheduledWorkspaceRenderOptions, scrollSessionId: null };
  }
  if (scheduledWorkspaceRenderOptions?.focusSessionId === sessionId) {
    scheduledWorkspaceRenderOptions = { ...scheduledWorkspaceRenderOptions, focusSessionId: null };
  }
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
  setAppNotice(`${removed.agentName} 已移出工作台，仍保留在活跃会话。`);
}

async function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const runtimeState = session ? sessionRuntimeState(session) : archived?.runtimeState || "archived";
  if (runtimeState === "restoring") {
    setAppNotice("该会话正在重连中，暂不支持删除。", "busy");
    return;
  }
  if (!session && !archived) return;
  if (isLaunchDemoScene && sessionId.startsWith("demo-session-")) {
    sessions = sessions.filter((item) => item.id !== sessionId);
    demoHistoryEntries = demoHistoryEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    renderWorkspace();
    renderHistory();
    setAppNotice("已从演示场景移除该会话。");
    return;
  }
  try {
    deletedSessionIds.add(sessionId);
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
    demoHistoryEntries = demoHistoryEntries.filter((entry) => historySessionKey(entry) !== sessionId);
    renderWorkspace();
    renderHistory();
    const skipped = result?.skippedFiles ? `，跳过损坏文件 ${result.skippedFiles} 个` : "";
    setAppNotice(`已删除会话，移除历史轮次 ${result?.removedCount || 0} 条${skipped}。`);
  } catch (error) {
    console.error(error);
    setAppNotice(`删除会话失败：${formatBackendError(error)}`, "error");
  }
}

function requestDeleteConfirmation(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
  const title = session?.task || archived?.title || "该会话";
  openConfirmDialog({
    title: "删除会话",
    message: `确定要删除「${title}」吗？此操作无法撤销。`,
    confirmLabel: "删除",
    onConfirm: () => deleteSession(sessionId),
  });
}

function renderWorkspace(options = {}) {
  const scrollSessionId = options.scrollSessionId || null;
  const focusSessionId = options.focusSessionId || null;
  const preserveDeckScroll = options.preserveDeckScroll === true;
  const deckScrollLeft = sessionDeck.scrollLeft;
  const deckScrollTop = sessionDeck.scrollTop;
  const activeBodies = [...sessionDeck.querySelectorAll(".session-card-body")].map((body) => ({
    sessionId: body.closest(".session-card")?.dataset.sessionId,
    shouldStickToBottom: body.scrollTop + body.clientHeight >= body.scrollHeight - 24,
  }));
  const workspaceSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
  const visibleSessions = [...workspaceSessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  document.body.classList.toggle("is-launch-demo", isLaunchDemoScene);
  sessionDeck.classList.toggle("is-launch-demo", isLaunchDemoScene);
  updatePromptPlaceholder();
  renderWorkspaceStatus();
  workspaceEmpty.style.display = visibleSessions.length ? "none" : "flex";
  sessionDeck.classList.toggle("is-single-session", visibleSessions.length === 1);
  sessionDeck.classList.toggle("is-two-sessions", visibleSessions.length === 2);
  sessionDeck.classList.toggle("is-many-sessions", visibleSessions.length > 2);
  sessionDeck.innerHTML = visibleSessions.map(renderSessionCard).join("");
  bindSessionActions();
  renderMermaidDiagrams().catch((error) => console.error(error));
  requestAnimationFrame(() => {
    const activeCard = currentSessionId
      ? sessionDeck.querySelector(`.session-card[data-session-id="${currentSessionId}"]`)
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
    if (preserveDeckScroll) {
      sessionDeck.scrollLeft = deckScrollLeft;
      sessionDeck.scrollTop = deckScrollTop;
    }
  });
}

function historySessionKey(entry) {
  return entry.sessionId || entry.session_id || entry.acpSessionId || entry.acp_session_id || entry.id;
}

function readableHistoryEntries() {
  return isLaunchDemoScene ? demoHistoryEntries : [...demoHistoryEntries, ...historyEntries];
}

function historyTurnKey(entry) {
  return `${historySessionKey(entry)}:${entry.turn?.id || entry.id}`;
}

function archivedSessionsFromHistory(entries) {
  const bySession = new Map();
  entries.forEach((entry) => {
    const key = historySessionKey(entry);
    const createdAt = entry.createdAt || entry.created_at;
    if (!key || !createdAt) return;
    const turn = entry.turn || {
      id: entry.id,
      task: entry.task,
      state: 5,
      thoughts: [],
      outputs: [],
      finalResponse: entry.summary,
      logs: ["由历史归档恢复，当前不是运行中的 runtime session。"],
      createdAt,
    };
    const current = bySession.get(key);
    const hermesProfile = entry.turn?.meta?.hermesProfile || null;
    if (!current) {
      bySession.set(key, {
        id: key,
        date: entry.date,
        createdAt,
        updatedAt: createdAt,
        providerId: entry.providerId || entry.provider_id,
        providerName: entry.providerName || entry.provider_name,
        agentId: entry.agentId || entry.agent_id,
        agentName: entry.agentName || entry.agent_name,
        runtimeInstanceId: entry.runtimeInstanceId || entry.runtime_instance_id || null,
        runtimeLabel: entry.runtimeLabel || entry.runtime_label || null,
        targetId: entry.targetId || entry.target_id || entry.agentId || entry.agent_id,
        targetName: entry.targetName || entry.target_name || entry.agentName || entry.agent_name,
        acpSessionId: entry.acpSessionId || entry.acp_session_id,
        title: entry.task,
        summary: entry.summary,
        turnCount: 1,
        turns: [turn],
        runtimeState: entry.runtimeState || entry.runtime_state || "archived",
        hermesProfile,
      });
      return;
    }
    current.updatedAt = current.updatedAt > createdAt ? current.updatedAt : createdAt;
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
  const sourceSessions = isLaunchDemoScene ? sessions.filter(isDemoSession) : sessions;
  const liveItems = sourceSessions.map((session) => {
    const lastTurn = session.turns.at(-1);
    return {
      id: session.id,
      date: session.createdAt.slice(0, 10),
      createdAt: session.createdAt,
      updatedAt: lastTurn?.createdAt || session.createdAt,
      providerName: session.providerName,
      agentName: session.agentName,
      title: session.task || t("history.newSession"),
      summary: lastTurn?.finalResponse || lastTurn?.outputs.at(-1) || lastTurn?.logs.at(-1) || t("session.current"),
      turnCount: session.turns.length,
      runtimeState: sessionRuntimeState(session),
      agentId: session.agentId,
      runtimeInstanceId: session.runtimeInstanceId || null,
      targetId: session.targetId || session.agentId,
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
  return [...liveItems, ...historyItems].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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
  const activeItems = sessionItems.filter(isActiveSessionListItem);
  const archivedItems = sessionItems.filter(isArchivedSessionListItem);
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
  const isActiveHistoryItem = currentSessionId === item.id;
  const isArchived = isArchivedSessionListItem(item);
  const signalClass = isActiveHistoryItem || item.isInWorkspace
    ? "signal-workspace"
    : isArchived
      ? "signal-archive"
      : "signal-active";
  const signalLabel = isActiveHistoryItem
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
        <strong class="history-tool-name"><span class="history-signal ${signalClass}" title="${escapeHtml(signalLabel)}" aria-label="${escapeHtml(signalLabel)}"></span>${escapeHtml(item.providerName)}</strong>
        <div class="history-item-actions">
          ${shouldShowState ? `<span class="history-state-pill">${escapeHtml(stateLabel)}</span>` : ""}
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
      isArchivedAgent: true,
    };
    provider.agents.push(agent);
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

async function restoreArchivedSession(sessionId) {
  if (!sessionId) return;
  const archived = archivedSessionsFromHistory(readableHistoryEntries()).find((item) => item.id === sessionId);
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
    runtimeInstanceId: archived.runtimeInstanceId || null,
    runtimeLabel: archived.runtimeLabel || null,
    targetId: archived.targetId || archived.agentId,
    targetName: archived.targetName || archived.agentName,
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
  restored.runtimeInstanceId = restored.runtimeInstanceId || restoredAgent.runtimeInstanceId || null;
  restored.runtimeLabel = restored.runtimeLabel || restoredAgent.runtimeLabel || null;
  restored.runtimeHost = restored.runtimeHost || restoredAgent.runtimeHost || null;
  restored.runtimeCommand = restored.runtimeCommand || restoredAgent.runtimeCommand || null;
  const restoredInstance = runtimeInstanceById(restored.runtimeInstanceId);
  if (restoredInstance) {
    restored.runtimeLabel = restored.runtimeLabel || restoredInstance.runtimeLabel || null;
    restored.runtimeHost = restored.runtimeHost || runtimeHostForInstance(restoredInstance);
    restored.runtimeCommand = restored.runtimeCommand || restoredInstance.command || null;
  }
  restored.targetId = restored.targetId || restored.agentId;
  restored.targetName = restored.targetName || restored.agentName;
  if (!existing) sessions = [restored, ...sessions];
  stoppedSessionIds.delete(restored.id);
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
      runtimeHost: restored.runtimeHost || null,
      runtimeCommand: restored.runtimeCommand || null,
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
        runtimeHost: restored.runtimeHost || null,
        runtimeCommand: restored.runtimeCommand || null,
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
      runtimeInstanceId: session.runtimeInstanceId || null,
      runtimeLabel: session.runtimeLabel || null,
      targetId: session.targetId || session.agentId,
      targetName: session.targetName || session.agentName,
      sessionId: session.id,
      acpSessionId: session.acpSessionId || null,
      task: turn.task,
      status: stateNames[turn.state] || "UNKNOWN",
      summary: turn.finalResponse || turn.outputs.at(-1) || turn.logs.at(0) || "消息已结束。",
      turn: turnForHistory,
      runtimeState: sessionRuntimeState(session),
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
    prependHermesStartupNoticeIfNeeded(session, turn);
    renderWorkspace({ scrollSessionId: session.id });
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
    const saved = updateTurnFromEvents(session.id, turn.id, fallback.events);
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
    if (saved) {
      await saveTurnToHistory(session, saved);
      setAppNotice(`${session.agentName} 会话已完成并写入历史。`);
    }
  } catch (error) {
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
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
    renderWorkspace({ scrollSessionId: session.id });
  }
  setAppNotice(`已将任务送入 ${session.agentName}，正在等待返回内容...`, "busy");
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const events = await invoke(commands.prompt, {
      runtimeSessionId: session.id,
      prompt: turn.task,
      cwd: null,
      runtimeHost: session.runtimeHost || null,
      runtimeCommand: session.runtimeCommand || null,
      profileExecutable: session.profileExecutable || null,
    });
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
    const saved = updateTurnFromEvents(session.id, turn.id, events);
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
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
    if (deletedSessionIds.has(session.id) || stoppedSessionIds.has(session.id)) return;
    appendErrorToTurn(session.id, turn.id, formatBackendError(error));
    await saveTurnToHistory(session, turn);
  } finally {
    runningSessions = Math.max(0, runningSessions - 1);
    updateActionLabels();
  }
}

function startSessionFromPrompt(forceNewSession = false) {
  if (isLaunchDemoScene) {
    setAppNotice("演示场景不会写入真实 runtime。请先清除演示再发送任务。", "busy");
    return;
  }
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
  if (!canSendToProvider(provider.id)) {
    const availability = providerAvailability(provider.id);
    const label = providerAvailabilityLabel(availability.summary);
    setAppNotice(`${provider.name} 当前${label}，请点击“维护”配置或检查本机 runtime。`, "error");
    return;
  }

  const session = getOrCreateActiveSession(task, forceNewSession);
  if (!session) return;
  if (forceNewSession) saveCurrentSession(null);
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

languageBtn?.addEventListener("click", () => {
  toggleLanguage();
});

demoSceneBtn?.addEventListener("click", () => {
  if (isLaunchDemoScene) {
    leaveLaunchDemoScene();
    return;
  }
  activateLaunchDemoScene();
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
applyStaticTranslations();
applyFontScale();
updateSendModeLabel();
renderWorkspace();
renderHistory();
updateActionLabels();
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
