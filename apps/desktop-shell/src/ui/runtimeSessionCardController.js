// Runtime Session Card Controller 负责卡片事件绑定、局部刷新和滚动粘连。
// 领域动作全部通过回调注入，控制器不自行修改 Session 生命周期。
import { patchSessionCardFromViewModel, patchSessionCardShell } from "./runtimeSessionCardPatch.js";
import { createRuntimeSessionVirtualList } from "./runtimeSessionVirtualList.js";

export function createRuntimeSessionCardController({
  sessionDeck,
  sessionStickRegistry,
  getSession,
  renderSessionCard,
  buildSessionCardViewModel,
  projectRuntimeSessionMessageList,
  runtimeSessionMessageListView,
  isSessionLatestOnly,
  renderMermaidDiagrams,
  scheduleWorkspaceRender,
  focusSessionInWorkspace,
  activateWorkspaceSession,
  toggleSessionFocus,
  dismissWorkspaceSession,
  archiveLiveSession,
  stopSession,
  requestDeleteConfirmation,
  restoreArchivedSession,
  setFlowDetailOpen,
  sessionTranscriptText,
  copyTextToClipboard,
  toggleSessionLatestOnly,
  setAppNotice,
  isAtBottom,
  t,
  streamRenderIntervalMs,
  requestFrame = (callback) => requestAnimationFrame(callback),
  setTimer = (callback, delay) => window.setTimeout(callback, delay),
  createTemplate = () => document.createElement("template"),
  isElement = (node) => node instanceof HTMLElement,
}) {
  const pendingCardRenders = new Set();
  const delegatedCards = new WeakSet();
  const delegatedBodies = new WeakSet();
  const delegatedActionRoots = new WeakSet();
  const lastScrollTargetRows = new Map();
  const virtualListRegistry = new Map();
  const virtualListCache = new Map();
  let pendingCardRenderFrame = 0;
  let pendingCardRenderTimer = 0;
  let lastCardRenderAt = 0;

  // 所有 Card、mini card 与 Turn 操作统一在重绘后重新绑定。
  function bindSessionActions(root = sessionDeck) {
    const actionRoot = root || sessionDeck;
    const cards = actionRoot.matches?.(".session-card")
      ? [actionRoot]
      : [...actionRoot.querySelectorAll(".session-card")];
    cards.forEach((card) => {
      if (delegatedCards.has(card)) return;
      delegatedCards.add(card);
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a, summary, details, input, textarea, select")) return;
        if (window.getSelection()?.toString()) return;
        activateWorkspaceSession(card.dataset.sessionId);
      });
      card.addEventListener("keydown", (event) => {
        if (event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        activateWorkspaceSession(card.dataset.sessionId);
      });
    });
    bindDelegatedSessionActions(actionRoot);
  }

  function bindDelegatedSessionActions(actionRoot) {
    if (!actionRoot?.addEventListener || delegatedActionRoots.has(actionRoot)) return;
    delegatedActionRoots.add(actionRoot);
    actionRoot.addEventListener("click", async (event) => {
      const button = event.target.closest?.(".session-action-btn, .session-retry-btn, .session-mini-card");
      if (!button || button.disabled) return;
      const sessionId = button.dataset.sessionId;
      if (!sessionId) return;

      if (button.closest(".session-fullscreen-btn")) return toggleSessionFocus(sessionId);
      if (button.closest(".session-mini-card")) {
        focusSessionInWorkspace(sessionId);
        return activateWorkspaceSession(sessionId);
      }
      if (button.closest(".session-dismiss-btn")) return dismissWorkspaceSession(sessionId);
      if (button.closest(".session-archive-btn")) return archiveLiveSession(sessionId);
      if (button.closest(".session-stop-btn")) return stopSession(sessionId);
      if (button.closest(".session-delete-btn")) return requestDeleteConfirmation(sessionId);
      if (button.closest(".session-retry-btn")) return restoreArchivedSession(sessionId);
      if (button.closest(".session-scroll-latest-btn")) {
        const body = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"] .session-card-body`);
        if (body) ensureMessageListStickController(sessionId, body, true)?.resumeFollowing();
        return;
      }
      if (button.closest(".session-copy-btn")) {
        const session = getSession(sessionId);
        const text = session ? sessionTranscriptText(session) : "";
        if (!text) return setAppNotice(t("session.noTranscript"), "busy");
        const copied = await copyTextToClipboard(text);
        return setAppNotice(copied ? t("session.copiedTranscript") : t("copy.selectManually"), copied ? "muted" : "error");
      }
      if (button.closest(".session-latest-only-btn")) return toggleSessionLatestOnly(sessionId);
    });
  }

  // 重绘前记录用户是否仍停留在底部，避免流式输出强抢滚动位置。
  function sampleSessionStickyIntent() {
    const map = new Map();
    sessionDeck.querySelectorAll(".session-card-body").forEach((body) => {
      const sessionId = body.closest(".session-card")?.dataset.sessionId;
      if (!sessionId) return;
      const controller = sessionStickRegistry.get(sessionId);
      const scroller = messageListElements(body).scroller || body;
      map.set(sessionId, controller ? controller.isFollowing : isAtBottom(scroller));
    });
    return map;
  }

  // 高频流式事件合并到固定刷新间隔，减少整个 Card 的重复替换。
  function scheduleSessionCardRender(sessionId) {
    if (!sessionId) return;
    pendingCardRenders.add(sessionId);
    if (pendingCardRenderFrame || pendingCardRenderTimer) return;
    const elapsed = Date.now() - lastCardRenderAt;
    const delayMs = Math.max(0, streamRenderIntervalMs - elapsed);
    const requestCardRender = () => {
      pendingCardRenderTimer = 0;
      pendingCardRenderFrame = requestFrame(() => {
        lastCardRenderAt = Date.now();
        pendingCardRenderFrame = 0;
        flushPendingSessionCardRenders();
      });
    };
    if (delayMs > 0) {
      pendingCardRenderTimer = setTimer(requestCardRender, delayMs);
      return;
    }
    requestCardRender();
  }

  function flushPendingSessionCardRenders() {
    if (!pendingCardRenders.size) return;
    const targets = [...pendingCardRenders];
    pendingCardRenders.clear();
    targets.forEach(renderSessionCardInPlace);
  }

  // 流式路径：从 viewModel 直接 patch Card 外壳，不生成完整 HTML。
  // 首次创建、Session 增删、Workspace Focus 切换时仍允许完整渲染。
  function renderSessionCardInPlace(sessionId) {
    const session = getSession(sessionId);
    if (!session) return;
    const card = sessionDeck.querySelector(`.session-card[data-session-id="${sessionId}"]`);
    if (!card) return scheduleWorkspaceRender({ preserveDeckScroll: true });
    const previousBody = card.querySelector(".session-card-body");
    const previousController = sessionStickRegistry.get(sessionId);
    const previousScroller = messageListElements(previousBody).scroller || previousBody;
    const previousFollowing = previousController ? previousController.isFollowing : previousScroller ? isAtBottom(previousScroller) : true;

    // 流式路径：从 viewModel 直接 patch，不生成完整 HTML
    const viewModel = buildSessionCardViewModel(session);
    const newBody = patchSessionCardFromViewModel(card, viewModel);

    // 对账 MessageList 正文（通过虚拟列表）
    const projection = projectRuntimeSessionMessageList(session, { latestOnly: isSessionLatestOnly(session) });
    if (newBody) {
      const elements = messageListElements(newBody);
      if (elements.scroller && elements.contentElement) {
        const virtualList = ensureSessionVirtualList(sessionId, elements);
        if (virtualList) {
          const report = virtualList.reconcile(projection.rows, {
            renderRow: (row) => runtimeSessionMessageListView.renderMessageRow(row),
            renderRowBody: (row) => runtimeSessionMessageListView.renderMessageRowBody(row),
          });
          // 保存 mutation report 供滚动模块消费
          if (elements.contentElement) {
            elements.contentElement.dataset.lastMutationReport = JSON.stringify(report);
          }
        }
      }
    }

    // Header 可能被局部 patch 替换，动作通过 Card 级委托保持稳定。
    bindSessionActions(card);
    bindMessageListDelegation(sessionId, newBody);
    // Mermaid 只处理 mutation report 中变化的 Assistant row
    renderMermaidForChangedRows(card, newBody).catch((error) => console.error(error));
    syncMessageListScroll(sessionId, newBody, projection, previousFollowing);
  }

  // 全量工作区重绘后只保留可见 Session 的 sticky 控制器。
  function syncSessionStickControllers(visibleSessions, stickyIntent) {
    const ids = [];
    visibleSessions.forEach((session) => {
      const body = sessionDeck.querySelector(`.session-card[data-session-id="${session.id}"]`)?.querySelector(".session-card-body");
      if (!body) return;
      const previousFollowing = stickyIntent.has(session.id) ? stickyIntent.get(session.id) : true;
      const projection = projectRuntimeSessionMessageList(session, { latestOnly: isSessionLatestOnly(session) });
      syncVirtualMessageList(session, body, projection);
      bindMessageListDelegation(session.id, body);
      syncMessageListScroll(session.id, body, projection, previousFollowing);
      ids.push(session.id);
    });
    sessionStickRegistry.sweep(ids);
  }

  function syncVirtualMessageList(session, body, projection) {
    const elements = messageListElements(body);
    if (!elements.scroller || !elements.contentElement) {
      runtimeSessionMessageListView.syncMessageList(body, projection);
      return;
    }
    const virtualList = ensureSessionVirtualList(session.id, elements);
    if (!virtualList) return;
    const report = virtualList.reconcile(projection.rows, {
      renderRow: (row) => runtimeSessionMessageListView.renderMessageRow(row),
      renderRowBody: (row) => runtimeSessionMessageListView.renderMessageRowBody(row),
    });
    elements.contentElement.dataset.lastMutationReport = JSON.stringify(report);
  }

  // MessageList 事件只绑定在稳定 body 上，局部更新不会重复监听。
  function ensureSessionVirtualList(sessionId, elements) {
    let virtualList = virtualListRegistry.get(sessionId);
    if (virtualList && (
      virtualList.getScroller?.() !== elements.scroller ||
      virtualList.getContentElement?.() !== elements.contentElement
    )) {
      // 工作区全量重绘会替换 DOM，旧虚拟列表必须释放后重新绑定新 scroller。
      virtualListCache.set(sessionId, virtualList.snapshotCache());
      virtualList.dispose();
      virtualListRegistry.delete(sessionId);
      virtualList = null;
    }
    if (virtualList) return virtualList;
    virtualList = createRuntimeSessionVirtualList({
      scroller: elements.scroller,
      content: elements.contentElement,
      estimateRowSize: 80,
      overscan: 6,
      getActiveRowId: () => activePromptRows(sessionId).find((row) => row.kind === "assistant")?.id || null,
      getPinnedRowIds: () => activePromptRows(sessionId).map((row) => row.id),
    });
    if (!virtualList) return null;
    const cached = virtualListCache.get(sessionId);
    if (cached) virtualList.restoreCache(cached);
    virtualListRegistry.set(sessionId, virtualList);
    return virtualList;
  }

  function activePromptRows(sessionId) {
    const latestSession = getSession(sessionId);
    if (!latestSession?.activePromptRunId) return [];
    const latestProjection = projectRuntimeSessionMessageList(latestSession, { latestOnly: isSessionLatestOnly(latestSession) });
    return latestProjection.rows.filter((row) => row.promptRunId === latestSession.activePromptRunId);
  }

  function bindMessageListDelegation(sessionId, body) {
    if (!body?.addEventListener || delegatedBodies.has(body)) return;
    delegatedBodies.add(body);
    body.addEventListener("click", (event) => {
      if (event.target.closest?.("[data-runtime-scroll-latest]")) {
        ensureMessageListStickController(sessionId, body, true)?.resumeFollowing();
        return;
      }
      const copyButton = event.target.closest?.(".md-code-copy-btn");
      if (!copyButton) return;
      const code = copyButton.closest(".md-code-block, .md-diagram-block")?.querySelector("code")?.textContent || "";
      if (!code) return setAppNotice(t("markdown.emptyCode"), "busy");
      copyTextToClipboard(code).then((copied) => {
        setAppNotice(copied ? t("markdown.copiedCode") : t("markdown.copyCodeFailed"), copied ? "muted" : "error");
      });
    });
    body.addEventListener("toggle", (event) => {
      const detail = event.target.closest?.("details");
      if (!detail) return;
      if (detail.matches?.(".terminal-detail[data-detail-key]")) {
        setFlowDetailOpen(detail.dataset.detailKey, detail.open);
      }
      if (detail.classList?.contains("runtime-message-debug") && detail.open) {
        revealDebugJson(detail);
        scheduleSessionCardRender(sessionId);
      }
      measureExpandedMessageRow(sessionId, detail);
    }, true);
  }

  function measureExpandedMessageRow(sessionId, detail) {
    const row = detail.closest?.("[data-message-id]");
    const rowId = row?.dataset?.messageId;
    const virtualList = rowId ? virtualListRegistry.get(sessionId) : null;
    if (!rowId || !virtualList) return;
    virtualList.measureChangedRows([rowId], { invalidate: true });
    // details 展开会改变动态行高；下一帧重新测量，避免后续行仍停在旧 offset 上造成遮挡。
    virtualList.measureChangedRows([rowId]);
    requestFrame(() => {
      virtualList.measureChangedRows([rowId], { invalidate: true });
      requestFrame(() => virtualList.measureChangedRows([rowId]));
    });
    setTimer(() => virtualList.measureChangedRows([rowId], { invalidate: true }), 0);
  }

  function revealDebugJson(detail) {
    const placeholder = detail.querySelector?.(".runtime-message-debug-placeholder");
    const template = detail.querySelector?.("template[data-debug-json]");
    if (!placeholder || !template) return;
    const pre = document.createElement("pre");
    pre.className = "terminal-pre";
    pre.textContent = template.content?.textContent || "";
    placeholder.parentNode?.replaceChild(pre, placeholder);
    template.remove();
  }

  function messageListElements(body) {
    return {
      scroller: body?.querySelector?.("[data-runtime-message-scroller]") || null,
      contentElement: body?.querySelector?.("[data-runtime-message-content]") || null,
      scrollLatestButton: body?.querySelector?.("[data-runtime-scroll-latest]") || null,
    };
  }

  // 滚动状态属于稳定 scroller；浮动按钮只反映状态机，不自行推断位置。
  function ensureMessageListStickController(sessionId, body, initialFollowing) {
    const elements = messageListElements(body);
    const scroller = elements.scroller || body;
    if (!scroller) return null;
    const controller = sessionStickRegistry.ensure(sessionId, scroller, {
      initialFollowing,
      contentElement: elements.contentElement,
      onStateChange: ({ showScrollButton }) => {
        if (elements.scrollLatestButton) elements.scrollLatestButton.hidden = !showScrollButton;
      },
    });
    controller?.setContentElement?.(elements.contentElement);
    if (elements.scrollLatestButton && controller) {
      elements.scrollLatestButton.hidden = !controller.showScrollButton;
    }
    return controller;
  }

  // 新 Prompt 显式定位到 user row；普通 delta 仅在 following 状态下跟随底部。
  // 虚拟列表测量变化只触发一次 requestAnimationFrame 对齐。
  function syncMessageListScroll(sessionId, body, projection, previousFollowing) {
    if (!body) return;
    const controller = ensureMessageListStickController(sessionId, body, previousFollowing);
    if (!controller) return;
    const nextTarget = projection.scrollTargetRowId || null;
    const virtualList = virtualListRegistry.get(sessionId);

    // 新 Prompt：通过虚拟列表定位到 user row
    if (projection.activePromptRunId && nextTarget && lastScrollTargetRows.get(sessionId) !== nextTarget) {
      lastScrollTargetRows.set(sessionId, nextTarget);
      if (!focusNewPromptInMessageList({ virtualList, controller, targetRowId: nextTarget })) {
        const elements = messageListElements(body);
        const targetRow = elements.contentElement?.querySelector?.(`[data-message-id="${nextTarget}"]`) || null;
        if (targetRow) {
          controller.scrollElementIntoView(targetRow, { behavior: "auto", block: "start" });
          controller.notifyUserSubmission?.();
        }
      }
      return;
    }

    // 流式 delta：通知内容变化，stickToBottom 自行判断是否跟随
    controller.notifyContentChanged();

    // 虚拟列表测量变化行（来自 mutation report）
    if (virtualList) {
      const elements = messageListElements(body);
      const reportText = elements.contentElement?.dataset?.lastMutationReport;
      if (reportText) {
        try {
          const report = JSON.parse(reportText);
          const changedIds = [...(report.changedIds || []), ...(report.addedIds || [])];
          if (changedIds.length) virtualList.measureChangedRows(changedIds);
        } catch (_) {
          // 忽略解析错误
        }
      }
    }
  }

  // 只对 mutation report 中变化的 Assistant row 渲染 Mermaid，避免全量扫描。
  async function renderMermaidForChangedRows(card, body) {
    if (!card || !body || !renderMermaidDiagrams) return;
    const elements = messageListElements(body);
    const reportText = elements.contentElement?.dataset?.lastMutationReport;
    if (!reportText) {
      // 无 mutation report 时回退到全量渲染（首次创建等场景）
      return renderMermaidDiagrams(card);
    }
    try {
      const report = JSON.parse(reportText);
      const changedAssistantIds = report.changedIds.filter((id) => id.includes(":assistant"));
      const addedAssistantIds = report.addedIds.filter((id) => id.includes(":assistant"));
      const targetIds = [...new Set([...changedAssistantIds, ...addedAssistantIds])];
      if (!targetIds.length) return;
      // 只对变化的 Assistant row 渲染 Mermaid
      for (const id of targetIds) {
        const row = elements.contentElement?.querySelector?.(`[data-message-id="${id}"]`);
        if (row) await renderMermaidDiagrams(row);
      }
    } catch (_) {
      // 解析失败时回退到全量渲染
      return renderMermaidDiagrams(card);
    }
  }

  // 释放指定 Session 的虚拟列表
  function disposeVirtualList(sessionId) {
    const virtualList = virtualListRegistry.get(sessionId);
    if (virtualList) {
      virtualListCache.set(sessionId, virtualList.snapshotCache());
      virtualList.dispose();
      virtualListRegistry.delete(sessionId);
    }
  }

  return {
    bindSessionActions,
    sampleSessionStickyIntent,
    refreshSessionCard: renderSessionCardInPlace,
    scheduleSessionCardRender,
    syncSessionStickControllers,
    disposeVirtualList,
  };
}

// 兼容旧测试入口：新实现不再替换外围 Card，只 patch 稳定外壳与正文 seam。
export function focusNewPromptInMessageList({ virtualList, controller, targetRowId } = {}) {
  if (!virtualList || !controller || !targetRowId) return false;
  virtualList.scrollToRow(targetRowId, { align: "start" });
  // 先挂载目标行，再恢复贴底；短 turn 不应在输入区上方留下整屏空白。
  controller.notifyUserSubmission?.();
  return true;
}

export function patchSessionCardPreservingBody(previousCard, nextArticle, { reconcileBody } = {}) {
  return patchSessionCardShell(previousCard, nextArticle, { reconcileBody });
}
