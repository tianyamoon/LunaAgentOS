import { t } from "../i18n/index.js";
import {
  TURN_STATUS,
  statusFromRuntimeEvent,
  statusFromRuntimeStateCode,
} from "../state/sessionStatus.js";
import {
  appendTurnTimelineEvent,
  finalizeTurnTimeline,
} from "./turnTimeline.js";

export function sessionSectionsFromEvents(events) {
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

export function eventContentText(event) {
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

export function contentPartText(part) {
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

export function eventLogText(event) {
  if (event.type === "tool") {
    const title = event.payload?.title || event.payload?.kind || event.payload?.id || t("event.toolCall");
    const status = event.payload?.status ? `${t("event.statusSeparator")}${event.payload.status}` : "";
    const content = contentPartText(event.payload?.content);
    return [title, status, content ? `\n${content}` : ""].join("").trim();
  }
  if (event.type === "plan") {
    const entries = event.payload?.entries;
    if (!Array.isArray(entries) || !entries.length) return t("event.planUpdated");
    const lines = entries.map((entry, index) => {
      const title = entry.title || entry.content || entry.task || entry.description || t("event.step", { index: index + 1 });
      const status = entry.status || entry.state || "";
      return `${status ? `[${status}] ` : ""}${title}`;
    });
    return [t("event.planUpdatedWithDetails"), ...lines].join("\n");
  }
  if (event.type === "usage") {
    const input = event.payload?.inputTokens ?? event.payload?.input_tokens ?? event.payload?.promptTokens;
    const output = event.payload?.outputTokens ?? event.payload?.output_tokens ?? event.payload?.completionTokens;
    const total = event.payload?.totalTokens ?? event.payload?.total_tokens;
    const parts = [
      input != null ? t("event.usageInput", { count: input }) : "",
      output != null ? t("event.usageOutput", { count: output }) : "",
      total != null ? t("event.usageTotal", { count: total }) : "",
    ].filter(Boolean);
    return parts.length ? t("event.usageUpdated", { parts: parts.join(" · ") }) : "";
  }
  return "";
}

export function applyEventsToTurn(session, turn, events, { now = Date.now } = {}) {
  const sections = sessionSectionsFromEvents(events);
  const lastState = [...events].reverse().find((event) => typeof event.state === "number");
  const acpSessionEvent = [...events].reverse().find((event) => event.payload?.sessionId);

  turn.thoughts = sections.thoughts;
  turn.outputs = sections.outputs;
  turn.finalResponse = sections.finalResponse;
  turn.logs = sections.logs;
  // 批量 ACP 与 fallback 结果是完整事件序列，只重建 Item；Turn 创建时间属于生命周期，不得重置。
  turn.timelineItems = [];
  turn.activeTimelineItemId = null;
  turn.timelineCompletedAt = null;
  events.forEach((event) => appendNormalizedTimelineEvent(turn, event, undefined, { now }));
  turn.state = lastState ? lastState.state : turn.state;
  turn.status = events.reduce(
    (status, event) => statusFromRuntimeEvent(event, status, Boolean(sections.finalResponse)),
    turn.status || statusFromRuntimeStateCode(turn.state, Boolean(sections.finalResponse)),
  );
  if (turn.status === TURN_STATUS.running && sections.finalResponse && lastState?.state === 5) {
    turn.status = TURN_STATUS.completed;
  }
  if (turn.status === TURN_STATUS.running && sections.finalResponse) {
    turn.status = TURN_STATUS.completed;
  }
  if (turn.status === TURN_STATUS.completed || turn.status === TURN_STATUS.failed) {
    if (turn.status === TURN_STATUS.completed) {
      turn.state = 5;
    }
    finalizeTurnTimeline(turn, { now });
  }
  if (acpSessionEvent?.payload?.sessionId) session.acpSessionId = acpSessionEvent.payload.sessionId;
  session.task = turn.task;
  session.state = turn.state;
  session.activeTurnId = turn.id;
  return turn;
}

export function applyStreamEventToTurn(session, turn, event, { now = Date.now } = {}) {
  const content = eventContentText(event);
  // 流式事件按到达顺序立即写入 Timeline，保留 Assistant 与 Tool 交叉发生的事实。
  appendNormalizedTimelineEvent(turn, event, content, { now });
  if (typeof event.state === "number") {
    turn.state = event.state;
    session.state = event.state;
  }
  turn.status = statusFromRuntimeEvent(
    event,
    turn.status || TURN_STATUS.created,
    Boolean(turn.finalResponse),
  );

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
        if (event.state === 5) turn.status = TURN_STATUS.completed;
      }
      break;
    case "tool":
      turn.logs = [
        content || `${event.payload?.title || event.payload?.kind || t("event.toolCall")} ${event.payload?.status || ""}`.trim(),
        ...turn.logs,
      ];
      break;
    case "plan":
      turn.logs = [content || t("event.planUpdated"), ...turn.logs];
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

  if (turn.status === TURN_STATUS.completed || turn.status === TURN_STATUS.failed) {
    finalizeTurnTimeline(turn, { now });
  }

  return turn;
}

// Timeline 使用与旧日志相同的可读文本，同时把原始 payload 留在 metadata 中供 Debug 层读取。
function appendNormalizedTimelineEvent(turn, event, content = eventContentText(event), { now = Date.now } = {}) {
  appendTurnTimelineEvent(turn, {
    ...event,
    payload: {
      ...(event.payload || {}),
      content,
    },
  }, { now });
}
