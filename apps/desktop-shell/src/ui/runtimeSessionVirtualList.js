// Runtime Session 虚拟列表适配层。
// 基于 @tanstack/virtual-core，但由本模块维护完整 rows 与 rowId/index 映射，
// DOM 只表示当前挂载窗口，不能反推真实消息顺序。

import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from "@tanstack/virtual-core";
import { messageRowClass } from "./runtimeSessionMessageListView.js";

export function createRuntimeSessionVirtualList({
  scroller,
  content,
  estimateRowSize = 80,
  overscan = 6,
  getActiveRowId = () => null,
  getPinnedRowIds = () => [],
  requestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame = (id) => cancelAnimationFrame(id),
} = {}) {
  if (!scroller || !content) return null;

  let rows = [];
  let rowIndexById = new Map();
  let rowElements = new Map();
  let rowHeights = new Map();
  let measureFrameId = 0;
  let pendingMeasureIds = new Set();
  let cleanupVirtualizer = null;
  let measuredWidth = 0;
  let currentRenderers = null;
  let reconciling = false;
  let renderingWindow = false;

  prepareContentElement(content);

  const virtualizer = new Virtualizer({
    count: 0,
    getScrollElement: () => scroller,
    estimateSize: (index) => {
      const row = rows[index];
      return row ? rowHeights.get(row.id) ?? estimateRowSize : estimateRowSize;
    },
    overscan,
    gap: 8,
    getItemKey: (index) => rows[index]?.id ?? `row-${index}`,
    rangeExtractor: (range) => rangeWithPinnedRows(range, pinnedRowIndexes()),
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: () => {
      if (!currentRenderers || reconciling || renderingWindow) return;
      renderVirtualWindow(emptyMutationReport());
    },
  });

  cleanupVirtualizer = virtualizer._didMount?.() || null;

  // 对账 rows 并更新虚拟窗口，返回 mutation report。
  function reconcile(nextRows, {
    renderRow,
    renderRowBody,
    createRowElement = defaultCreateRowElement,
  } = {}) {
    if (!Array.isArray(nextRows)) return emptyMutationReport();

    const report = emptyMutationReport();
    currentRenderers = { renderRow, renderRowBody, createRowElement };
    reconciling = true;
    try {
      rows = nextRows;
      rowIndexById = new Map(rows.map((row, index) => [row.id, index]));
      adoptExistingRowNodes();
      dropRemovedRows(report);
      const widthChanged = invalidateMeasurementsIfWidthChanged();
      updateVirtualizerOptions();
      renderVirtualWindow(report, { measureAllMounted: widthChanged });
    } finally {
      reconciling = false;
    }
    return report;
  }

  function renderVirtualWindow(report, { measureAllMounted = false } = {}) {
    if (!currentRenderers || renderingWindow) return;
    renderingWindow = true;
    try {
      const virtualItems = virtualizer.getVirtualItems();
      content.style.height = `${Math.max(virtualizer.getTotalSize(), scroller.clientHeight || 0)}px`;

      const mountedIds = new Set();
      const orderedNodes = [];
      virtualItems.forEach((virtualItem) => {
        const row = rows[virtualItem.index];
        if (!row) return;
        const node = ensureRowNode(row, currentRenderers, report);
        positionRowNode(node, virtualItem.index, virtualItem.start);
        mountedIds.add(row.id);
        orderedNodes.push(node);
      });

      unmountRowsOutsideWindow(mountedIds);
      reconcileMountedOrder(orderedNodes, report);
      scheduleMeasure(measureAllMounted ? [...mountedIds] : [...report.addedIds, ...report.changedIds]);
    } finally {
      renderingWindow = false;
    }
  }

  function invalidateMeasurementsIfWidthChanged() {
    const nextWidth = currentScrollerWidth(scroller);
    if (!nextWidth) return false;
    if (!measuredWidth) {
      measuredWidth = nextWidth;
      return false;
    }
    if (Math.abs(nextWidth - measuredWidth) < 1) return false;
    // 多卡片 grid 会让同一条消息从宽列切到窄列；旧行高缓存会造成行重叠，宽度变化时必须重测。
    measuredWidth = nextWidth;
    rowHeights.clear();
    return true;
  }

  function updateVirtualizerOptions() {
    virtualizer.setOptions({
      ...virtualizer.options,
      count: rows.length,
      getScrollElement: () => scroller,
      estimateSize: (index) => {
        const row = rows[index];
        return row ? rowHeights.get(row.id) ?? estimateRowSize : estimateRowSize;
      },
      getItemKey: (index) => rows[index]?.id ?? `row-${index}`,
      rangeExtractor: (range) => rangeWithPinnedRows(range, pinnedRowIndexes()),
      gap: 8,
    });
    virtualizer._willUpdate?.();
  }

  function pinnedRowIndexes() {
    // 运行中的 prompt 行需要常驻挂载，避免局部刷新时过程行被虚拟窗口漏掉。
    const ids = new Set();
    const activeRowId = getActiveRowId() || null;
    if (activeRowId) ids.add(activeRowId);
    const pinnedIds = typeof getPinnedRowIds === "function" ? getPinnedRowIds() : [];
    if (Array.isArray(pinnedIds)) pinnedIds.filter(Boolean).forEach((id) => ids.add(id));
    return [...ids]
      .map((id) => rowIndexById.get(id))
      .filter((index) => Number.isInteger(index) && index >= 0);
  }

  function ensureRowNode(row, renderers, report) {
    const signature = rowSignature(row);
    let node = rowElements.get(row.id);
    if (!node) {
      node = createNode(row, renderers);
      rowElements.set(row.id, node);
      report.addedIds.push(row.id);
    } else if (
      node.dataset?.messageSignature !== signature ||
      node.dataset?.virtualListAdopted === "pending"
    ) {
      updateNodeBody(node, row, renderers);
      report.changedIds.push(row.id);
    } else {
      report.stableIds.push(row.id);
    }
    node.dataset.messageId = row.id;
    node.dataset.messageKind = row.kind || "";
    node.dataset.messageSignature = signature;
    delete node.dataset.virtualListAdopted;
    return node;
  }

  function createNode(row, { renderRow, createRowElement }) {
    if (renderRow) return createRowElement(renderRow(row));
    const node = document.createElement("div");
    node.className = messageRowClass(row);
    return node;
  }

  function updateNodeBody(node, row, { renderRowBody }) {
    node.className = messageRowClass(row);
    if (renderRowBody) node.innerHTML = renderRowBody(row);
  }

  function positionRowNode(node, index, start) {
    node.dataset.index = String(index);
    node.setAttribute?.("data-index", String(index));
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.width = "100%";
    node.style.transform = `translateY(${start}px)`;
  }

  function reconcileMountedOrder(orderedNodes, report) {
    orderedNodes.forEach((node, index) => {
      const currentChild = content.children?.[index] || null;
      if (currentChild === node) return;
      if (currentChild && typeof content.insertBefore === "function") content.insertBefore(node, currentChild);
      else content.append(node);
      const id = node.dataset?.messageId;
      if (id && !report.addedIds.includes(id)) report.movedIds.push(id);
    });
  }

  function unmountRowsOutsideWindow(mountedIds) {
    [...content.children].forEach((child) => {
      const id = child.dataset?.messageId;
      if (id && !mountedIds.has(id)) child.remove();
    });
  }

  function dropRemovedRows(report) {
    const activeIds = new Set(rows.map((row) => row.id));
    rowElements.forEach((node, id) => {
      if (activeIds.has(id)) return;
      node.remove?.();
      rowElements.delete(id);
      rowHeights.delete(id);
      report.removedIds.push(id);
    });
  }

  function adoptExistingRowNodes() {
    // 首屏 HTML 可能已经渲染了完整消息行，虚拟列表首次接管时要复用它们。
    const activeIds = new Set(rows.map((row) => row.id));
    const claimedIds = new Set();
    [...content.children].forEach((child) => {
      const id = child.dataset?.messageId;
      if (!id) return;
      if (!activeIds.has(id)) {
        child.remove?.();
        return;
      }
      const mapped = rowElements.get(id);
      if (!mapped || !contentContains(mapped)) {
        if (claimedIds.has(id)) {
          child.remove?.();
          return;
        }
        rowElements.set(id, child);
        child.dataset.virtualListAdopted = "pending";
        claimedIds.add(id);
        return;
      }
      if (mapped === child && !claimedIds.has(id)) {
        claimedIds.add(id);
        return;
      }
      child.remove?.();
    });
  }

  function contentContains(node) {
    if (!node) return false;
    if (typeof content.contains === "function") return content.contains(node);
    return Array.isArray(content.children) && content.children.includes(node);
  }

  // 测量变化行高度，按 rowId 缓存，避免窗口滚动后 index 错配。
  function scheduleMeasure(rowIds) {
    rowIds.forEach((id) => pendingMeasureIds.add(id));
    if (measureFrameId) return;
    measureFrameId = requestFrame(() => {
      measureFrameId = 0;
      const ids = [...pendingMeasureIds];
      pendingMeasureIds.clear();
      let changed = false;
      ids.forEach((id) => {
        const el = rowElements.get(id);
        const index = rowIndexById.get(id);
        if (!el || index === undefined) return;
        const height = el.getBoundingClientRect?.().height || el.offsetHeight || 0;
        if (height <= 0) return;
        if (rowHeights.get(id) === height) return;
        rowHeights.set(id, height);
        virtualizer.resizeItem?.(index, height);
        changed = true;
      });
      if (changed) relayoutMountedRows();
    });
  }

  // 测量完成后重新定位已挂载节点，避免动态高度行短暂压到下一行上。
  function relayoutMountedRows() {
    const virtualItems = virtualizer.getVirtualItems();
    content.style.height = `${Math.max(virtualizer.getTotalSize(), scroller.clientHeight || 0)}px`;
    virtualItems.forEach((virtualItem) => {
      const row = rows[virtualItem.index];
      const node = row ? rowElements.get(row.id) : null;
      if (node && content.contains?.(node)) positionRowNode(node, virtualItem.index, virtualItem.start);
    });
  }

  // 滚动到指定 rowId，允许目标行尚未挂载。
  function scrollToRow(rowId, options = {}) {
    const index = rowIndexById.get(rowId);
    if (index === undefined) return;
    const before = scroller.scrollTop ?? 0;
    virtualizer.scrollToIndex(index, { align: "start", ...options });
    // WebView 或测试环境中 Virtualizer 可能尚未完成测量，保底使用完整 rows 估算偏移。
    const offset = estimatedOffsetForIndex(index, rows, rowHeights, estimateRowSize);
    const current = scroller.scrollTop ?? 0;
    if (index > 0 && (current === before || current < offset - estimateRowSize)) {
      if (scroller.scrollTo) scroller.scrollTo({ top: offset, behavior: options.behavior || "auto" });
      else scroller.scrollTop = offset;
    }
  }

  function measureChangedRows(rowIds, { invalidate = false } = {}) {
    if (!rowIds?.length) return;
    if (invalidate) {
      rowIds.forEach((id) => {
        rowHeights.delete(id);
        const index = rowIndexById.get(id);
        if (index !== undefined) virtualizer.resizeItem?.(index, estimateRowSize);
      });
    }
    scheduleMeasure(rowIds);
  }

  function dispose() {
    if (measureFrameId) {
      cancelFrame(measureFrameId);
      measureFrameId = 0;
    }
    cleanupVirtualizer?.();
    cleanupVirtualizer = null;
    rowElements.clear();
    rowHeights.clear();
    pendingMeasureIds.clear();
  }

  function restoreCache(cachedHeights) {
    if (cachedHeights instanceof Map) rowHeights = new Map(cachedHeights);
  }

  function snapshotCache() {
    return new Map(rowHeights);
  }

  return {
    reconcile,
    scrollToRow,
    measureChangedRows,
    dispose,
    restoreCache,
    snapshotCache,
    getScroller: () => scroller,
    getContentElement: () => content,
    getVirtualItems: () => virtualizer.getVirtualItems(),
  };
}

function estimatedOffsetForIndex(index, rows, rowHeights, estimateRowSize) {
  let offset = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const id = rows[cursor]?.id;
    offset += (id ? rowHeights.get(id) : null) ?? estimateRowSize;
    offset += 8;
  }
  return offset;
}

function currentScrollerWidth(scroller) {
  if (!scroller) return 0;
  const rectWidth = scroller.getBoundingClientRect?.().width || 0;
  return scroller.clientWidth || scroller.offsetWidth || rectWidth || 0;
}

function prepareContentElement(content) {
  content.style.position = "relative";
  content.style.width = "100%";
  content.style.minHeight = content.style.minHeight || "100%";
}

function rangeWithPinnedRows(range, pinnedIndexes) {
  const start = Math.max(range.startIndex - range.overscan, 0);
  const end = Math.min(range.endIndex + range.overscan, range.count - 1);
  const indexes = [];
  for (let index = start; index <= end; index += 1) indexes.push(index);
  pinnedIndexes.forEach((index) => {
    if (index >= 0 && index < range.count && !indexes.includes(index)) indexes.push(index);
  });
  return indexes.sort((a, b) => a - b);
}

function rowSignature(row) {
  const meta = row.metadata || {};
  const items = Array.isArray(meta.items) ? meta.items.map((item) => item.content || "").join(",") : "";
  const traceRows = Array.isArray(meta.rows) ? meta.rows.map((item) => rowSignature(item)).join(";") : "";
  return [
    row.kind,
    row.status,
    row.content,
    meta.final ? "final" : "",
    meta.summary ? JSON.stringify(meta.summary) : "",
    items,
    traceRows,
    meta.attachmentCount ?? "",
  ].join("|");
}

function defaultCreateRowElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function emptyMutationReport() {
  return {
    addedIds: [],
    changedIds: [],
    movedIds: [],
    removedIds: [],
    stableIds: [],
  };
}
