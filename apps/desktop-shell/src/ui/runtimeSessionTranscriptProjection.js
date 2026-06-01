// Runtime Session Transcript Projection 模块。
// 将 Session 事实整理为 Card View Model，视图不再分别猜测最新轮、历史轮和队列状态。

import { projectCompletedTimelineSummary } from "./turnTimelineProjection.js";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(value, maxLength = 108) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function responseText(turn) {
  return turn?.finalResponse || list(turn?.outputs).join("\n\n");
}

// 历史轮只暴露阅读摘要；原始 payload 和完整日志继续留在 Debug 层。
function projectPreviousTurn(turn, index) {
  return {
    id: turn.id,
    index,
    status: turn.status,
    task: turn.task || "",
    summary: compactText(responseText(turn) || turn.task),
    timelineSummary: projectCompletedTimelineSummary(turn),
    turn,
  };
}

// 队列项按输入快照展示，不包含 runtime prompt 正文，避免附件内容挤进 Card 默认阅读流。
function projectQueuedSubmission(submission) {
  return {
    id: submission.id,
    task: compactText(submission.task),
    attachmentCount: list(submission.attachments).length,
    createdAt: submission.createdAt || null,
  };
}

// 统一投影 Session Card 所需事实。状态计算继续复用既有 Session Status Module。
export function projectRuntimeSessionTranscript(session, {
  resolveStatusView,
  translate,
} = {}) {
  const turns = list(session?.turns);
  const latestTurn = turns.at(-1) || null;
  const queuedSubmissions = list(session?.queuedSubmissions).map(projectQueuedSubmission);
  const cardStatus = resolveStatusView(session, { translate });
  return {
    header: {
      cardStatus,
      activePromptRunId: session?.activePromptRunId || null,
      queuedCount: queuedSubmissions.length,
    },
    cardStatus,
    latestTurn,
    previousTurns: turns.slice(0, -1).map(projectPreviousTurn),
    queuedSubmissions,
    scrollMode: session?.activePromptRunId ? "following_active_run" : "stable",
  };
}

