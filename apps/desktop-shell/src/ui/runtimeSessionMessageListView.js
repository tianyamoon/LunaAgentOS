// Runtime Session 连续 MessageList 视图。
// 行使用稳定 data-message-id；流式刷新时仅更新变化行，避免替换整个滚动容器。

export function createRuntimeSessionMessageListView({
  renderAssistantResponse,
  isOpenForKey,
  t,
  escapeHtml,
}) {
  function renderMessageListShell(projection) {
    return `
      <div class="runtime-message-list">
        <div class="runtime-message-list-scroller" data-runtime-message-scroller>
          <div class="runtime-message-list-content" data-runtime-message-content>
            ${projection.rows.map(renderMessageRow).join("")}
          </div>
        </div>
        <button type="button" class="runtime-message-scroll-latest-btn" data-runtime-scroll-latest hidden title="${escapeHtml(t("action.scrollLatest"))}" aria-label="${escapeHtml(t("action.scrollLatest"))}">
          <span aria-hidden="true">↓</span>
        </button>
      </div>
    `;
  }

  function renderMessageRow(row) {
    const signature = rowSignature(row);
    return `<div class="runtime-message-row runtime-message-row-${escapeHtml(row.kind)}" data-message-id="${escapeHtml(row.id)}" data-message-kind="${escapeHtml(row.kind)}" data-message-signature="${escapeHtml(signature)}">${renderMessageRowBody(row)}</div>`;
  }

  function renderMessageRowBody(row) {
    if (row.kind === "user") return renderUserRow(row);
    if (row.kind === "assistant") return renderAssistantRow(row);
    if (row.kind === "thinking") return renderThinkingRow(row);
    if (row.kind === "tool_group") return renderToolGroupRow(row);
    if (row.kind === "worked_for") return renderWorkedForRow(row);
    if (row.kind === "debug") return renderDebugRow(row);
    if (row.kind === "queue") return renderQueueRow(row);
    if (row.kind === "legacy_warning") return renderLegacyWarningRow();
    return renderCompactEventRow(row);
  }

  function renderUserRow(row) {
    const attachments = Array.isArray(row.metadata?.attachments) ? row.metadata.attachments : [];
    return `
      <div class="runtime-message-user-bubble">${escapeHtml(row.content)}</div>
      ${attachments.length ? `<div class="runtime-message-attachments">${attachments.map((attachment) => `<span>${escapeHtml(attachment.name || t("turn.attachment.unnamed"))}</span>`).join("")}</div>` : ""}
    `;
  }

  function renderAssistantRow(row) {
    const phase = row.metadata?.final ? "final" : "streaming";
    return `
      <section class="runtime-message-assistant ${row.status === "running" ? "is-streaming" : ""}">
        <div class="runtime-message-label">${escapeHtml(t("turn.timeline.assistant"))}</div>
        ${renderAssistantResponse(row.content || t("turn.waiting"), phase)}
      </section>
    `;
  }

  function renderThinkingRow(row) {
    return `
      <section class="runtime-message-thinking ${statusClass(row)}">
        ${renderEventHeading(row, t("turn.timeline.thinking"))}
        <div class="runtime-message-event-content">${escapeHtml(row.content || t("turn.timeline.thinking"))}</div>
      </section>
    `;
  }

  function renderCompactEventRow(row) {
    const detailKey = `${row.id}:message`;
    const open = isOpenForKey(detailKey, row.kind === "error" || row.status === "failed");
    return `
      <details class="terminal-detail runtime-message-event runtime-message-event-${escapeHtml(row.kind)} ${statusClass(row)}" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary>${renderEventHeading(row)}<span class="turn-event-arrow" aria-hidden="true"></span></summary>
        ${row.content ? `<pre class="terminal-pre">${escapeHtml(row.content)}</pre>` : ""}
      </details>
    `;
  }

  function renderToolGroupRow(row) {
    const detailKey = `${row.id}:message-group`;
    const tools = Array.isArray(row.metadata?.items) ? row.metadata.items : [];
    const open = isOpenForKey(detailKey, row.status === "running");
    return `
      <details class="terminal-detail runtime-message-event runtime-message-event-tool-group ${statusClass(row)}" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary>${renderEventHeading(row, t("turn.timeline.exploreTools", { count: tools.length }))}<span class="turn-event-arrow" aria-hidden="true"></span></summary>
        <ul>${tools.map((tool) => `<li>${escapeHtml(tool.content || t("turn.timeline.emptyEvent"))}</li>`).join("")}</ul>
      </details>
    `;
  }

  function renderWorkedForRow(row) {
    const summary = row.metadata?.summary || {};
    const detailKey = `${row.id}:message-trace`;
    const open = isOpenForKey(detailKey, row.status === "failed");
    const traceRows = Array.isArray(row.metadata?.rows) ? row.metadata.rows : [];
    return `
      <details class="terminal-detail runtime-message-worked-for" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary>
          <span>${escapeHtml(workedForLabel(summary))}</span>
          <span class="turn-event-arrow" aria-hidden="true"></span>
        </summary>
        ${summary.legacyApproximation ? `<p class="runtime-message-legacy-note">${escapeHtml(t("turn.timeline.legacyApproximation"))}</p>` : ""}
        <div class="runtime-message-trace">${traceRows.map(renderMessageRow).join("")}</div>
      </details>
    `;
  }

  function renderDebugRow(row) {
    const detailKey = `${row.id}:message-debug`;
    const open = isOpenForKey(detailKey, false);
    return `
      <details class="terminal-detail runtime-message-debug" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary>${escapeHtml(t("turn.timeline.debug"))}</summary>
        <pre class="terminal-pre">${escapeHtml(stringifyDebug(row.metadata))}</pre>
      </details>
    `;
  }

  function renderQueueRow(row) {
    return `
      <div class="runtime-message-queue">
        <span>${escapeHtml(t("session.followUpQueuedRow"))}</span>
        <strong>${escapeHtml(row.content)}</strong>
        ${row.metadata?.attachmentCount ? `<small>${escapeHtml(t("session.followUpAttachmentCount", { count: row.metadata.attachmentCount }))}</small>` : ""}
      </div>
    `;
  }

  function renderLegacyWarningRow() {
    return `<div class="runtime-message-legacy-warning">${escapeHtml(t("turn.historyIntegrityWarning"))}</div>`;
  }

  function renderEventHeading(row, title = row.content) {
    return `
      <span class="turn-event-dot" aria-hidden="true"></span>
      <span class="runtime-message-event-kind">${escapeHtml(t(`turn.timeline.kind.${row.kind}`))}</span>
      <span class="runtime-message-event-title">${escapeHtml(title || t("turn.timeline.emptyEvent"))}</span>
    `;
  }

  function workedForLabel(summary) {
    return t("turn.timeline.workedFor", {
      duration: formatRuntimeMessageDuration(summary.durationMs),
      tools: summary.toolCount ? t("turn.timeline.toolCount", { count: summary.toolCount }) : "",
      files: summary.fileChangeCount ? t("turn.timeline.fileCount", { count: summary.fileChangeCount }) : "",
    });
  }

  // 已有壳只对账消息行；首次进入时才创建 scroller，保证拖动中的 scrollbar 不会失效。
  function syncMessageList(container, projection) {
    if (!container) return null;
    let contentElement = container.querySelector?.("[data-runtime-message-content]") || null;
    if (!contentElement) {
      container.innerHTML = renderMessageListShell(projection);
      contentElement = container.querySelector?.("[data-runtime-message-content]") || null;
    } else {
      reconcileMessageList(contentElement, projection.rows, {
        renderMessageRow,
        renderMessageRowBody,
      });
    }
    return {
      scroller: container.querySelector?.("[data-runtime-message-scroller]") || null,
      contentElement,
      scrollLatestButton: container.querySelector?.("[data-runtime-scroll-latest]") || null,
      scrollTargetRow: projection.scrollTargetRowId
        ? contentElement?.querySelector?.(`[data-message-id="${projection.scrollTargetRowId}"]`) || null
        : null,
    };
  }

  return {
    renderMessageListShell,
    renderMessageRow,
    renderMessageRowBody,
    syncMessageList,
  };
}

// MessageList 自己持有轻量格式化，避免重新依赖已经准备退场的旧轮次视图。
export function formatRuntimeMessageDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// 对账只替换变化行的内部内容；已有行节点保持稳定，滚动条拖动不会失去目标容器。
export function reconcileMessageList(contentElement, rows, {
  renderMessageRow,
  renderMessageRowBody,
  createRowElement = defaultCreateRowElement,
} = {}) {
  if (!contentElement) return [];
  const report = {
    addedIds: [],
    changedIds: [],
    movedIds: [],
    removedIds: [],
    stableIds: [],
  };
  const existing = new Map(
    [...contentElement.querySelectorAll(":scope > [data-message-id]")]
      .map((node) => [node.dataset.messageId, node]),
  );
  const activeIds = new Set();
  const result = [];
  rows.forEach((row, index) => {
    const signature = rowSignature(row);
    let node = existing.get(row.id) || null;
    if (!node) {
      node = createRowElement(renderMessageRow(row));
      report.addedIds.push(row.id);
    } else if (node.dataset.messageSignature !== signature) {
      node.className = `runtime-message-row runtime-message-row-${row.kind}`;
      node.dataset.messageKind = row.kind;
      node.dataset.messageSignature = signature;
      node.innerHTML = renderMessageRowBody(row);
      report.changedIds.push(row.id);
    } else {
      report.stableIds.push(row.id);
    }
    if (!node) return;
    activeIds.add(row.id);
    const currentNode = contentElement.children?.[index] || null;
    if (currentNode !== node) {
      if (currentNode && typeof contentElement.insertBefore === "function") {
        contentElement.insertBefore(node, currentNode);
      } else {
        contentElement.append(node);
      }
      if (!report.addedIds.includes(row.id)) report.movedIds.push(row.id);
    }
    result.push(node);
  });
  existing.forEach((node, id) => {
    if (!activeIds.has(id)) {
      report.removedIds.push(id);
      node.remove();
    }
  });
  result.report = report;
  return result;
}

export function rowSignature(row) {
  return JSON.stringify(row);
}

function defaultCreateRowElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function stringifyDebug(metadata) {
  try {
    return JSON.stringify(metadata || {}, null, 2);
  } catch (error) {
    return String(error?.message || error);
  }
}

function statusClass(row) {
  return `runtime-message-status-${row.status || "completed"}`;
}
