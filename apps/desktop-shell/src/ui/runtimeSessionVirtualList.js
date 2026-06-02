// Runtime Session 虚拟列表适配层。
// 基于 @tanstack/virtual-core，只挂载可视区 + overscan 区 + 当前 active row。
// 使用 data-message-id 作为稳定 key，动态测量行高度。

import { Virtualizer } from "@tanstack/virtual-core";

export function createRuntimeSessionVirtualList({
  scroller,
  content,
  estimateRowSize = 80,
  overscan = 6,
  getActiveRowId = () => null,
  requestFrame = (cb) => requestAnimationFrame(cb),
  cancelFrame = (id) => cancelAnimationFrame(id),
} = {}) {
  if (!scroller || !content) return null;

  let rowElements = new Map();
  let rowHeights = new Map();
  let activeRowId = null;
  let measureFrameId = 0;
  let pendingMeasureIds = new Set();

  const virtualizer = new Virtualizer({
    count: 0,
    getScrollElement: () => scroller,
    estimateSize: (index) => rowHeights.get(index) ?? estimateRowSize,
    overscan,
    observeElementRect: (instance, cb) => {
      const rect = scroller.getBoundingClientRect();
      cb({ width: rect.width, height: rect.height });
    },
    observeElementOffset: (instance, cb) => {
      cb(scroller.scrollTop ?? 0);
    },
    scrollToFn: (offset, options, instance) => {
      if (scroller.scrollTo) {
        scroller.scrollTo({ top: offset, behavior: options?.behavior || "auto" });
      } else {
        scroller.scrollTop = offset;
      }
    },
    getItemKey: (index) => {
      const child = content.children?.[index];
      return child?.dataset?.messageId ?? `row-${index}`;
    },
  });

  // 测量变化行高度
  function scheduleMeasure(rowIds) {
    rowIds.forEach((id) => pendingMeasureIds.add(id));
    if (measureFrameId) return;
    measureFrameId = requestFrame(() => {
      measureFrameId = 0;
      const ids = [...pendingMeasureIds];
      pendingMeasureIds.clear();
      ids.forEach((id) => {
        const el = rowElements.get(id);
        if (!el) return;
        const index = virtualizer.options.count > 0
          ? [...content.children].indexOf(el)
          : -1;
        if (index < 0) return;
        const height = el.getBoundingClientRect().height;
        if (height > 0) {
          rowHeights.set(index, height);
          virtualizer.measure();
        }
      });
    });
  }

  // 对账 rows 并更新虚拟列表
  function reconcile(rows, { renderRow, renderRowBody } = {}) {
    if (!rows) return;

    const prevCount = virtualizer.options.count;
    virtualizer.options.count = rows.length;

    // 跟踪 active row
    activeRowId = getActiveRowId() || null;

    // 清理不再需要的元素引用
    const activeIds = new Set(rows.map((r) => r.id));
    rowElements.forEach((el, id) => {
      if (!activeIds.has(id)) {
        rowElements.delete(id);
        rowHeights.delete(id);
      }
    });

    // 更新虚拟列表渲染
    const virtualItems = virtualizer.getVirtualItems();

    // 确保 active row 始终挂载
    let hasActiveRow = false;
    if (activeRowId) {
      hasActiveRow = virtualItems.some((item) => {
        const child = content.children?.[item.index];
        return child?.dataset?.messageId === activeRowId;
      });
    }

    // 渲染可视区内的行
    virtualItems.forEach((virtualItem) => {
      const row = rows[virtualItem.index];
      if (!row) return;

      let node = rowElements.get(row.id);
      if (!node) {
        // 创建新行
        if (renderRow) {
          const template = document.createElement("template");
          template.innerHTML = renderRow(row).trim();
          node = template.content.firstElementChild;
        } else {
          node = document.createElement("div");
          node.className = "runtime-message-row";
          node.dataset.messageId = row.id;
        }
        rowElements.set(row.id, node);
      }

      // 定位到正确位置
      const currentChild = content.children?.[virtualItem.index];
      if (currentChild !== node) {
        if (currentChild && typeof content.insertBefore === "function") {
          content.insertBefore(node, currentChild);
        } else {
          content.append(node);
        }
      }

      // 更新样式
      node.style.position = "absolute";
      node.style.top = "0";
      node.style.left = "0";
      node.style.width = "100%";
      node.style.transform = `translateY(${virtualItem.start}px)`;
    });

    // 如果 active row 不在可视区，强制挂载
    if (activeRowId && !hasActiveRow) {
      const activeRow = rows.find((r) => r.id === activeRowId);
      const activeIndex = activeRow ? rows.indexOf(activeRow) : -1;
      if (activeRow && activeIndex >= 0) {
        let node = rowElements.get(activeRowId);
        if (!node && renderRow) {
          const template = document.createElement("template");
          template.innerHTML = renderRow(activeRow).trim();
          node = template.content.firstElementChild;
          rowElements.set(activeRowId, node);
        }
        if (node) {
          const estimatedStart = activeIndex * estimateRowSize;
          node.style.position = "absolute";
          node.style.top = "0";
          node.style.left = "0";
          node.style.width = "100%";
          node.style.transform = `translateY(${estimatedStart}px)`;
          if (!content.contains(node)) {
            content.append(node);
          }
        }
      }
    }

    // 移除不在可视区且不是 active 的行
    const mountedIds = new Set(virtualItems.map((item) => {
      const child = content.children?.[item.index];
      return child?.dataset?.messageId;
    }).filter(Boolean));

    if (activeRowId) mountedIds.add(activeRowId);

    [...content.children].forEach((child) => {
      const id = child.dataset?.messageId;
      if (id && !mountedIds.has(id)) {
        child.remove();
      }
    });
  }

  // 滚动到指定行
  function scrollToRow(rowId, options = {}) {
    const node = rowElements.get(rowId);
    if (!node) return;
    const index = [...content.children].indexOf(node);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: "start", ...options });
  }

  // 测量变化行
  function measureChangedRows(rowIds) {
    if (!rowIds?.length) return;
    scheduleMeasure(rowIds);
  }

  // 释放资源
  function dispose() {
    if (measureFrameId) {
      cancelFrame(measureFrameId);
      measureFrameId = 0;
    }
    try {
      virtualizer._willUpdate();
    } catch (_) {
      // 忽略 dispose 时的内部错误
    }
    rowElements.clear();
    rowHeights.clear();
    pendingMeasureIds.clear();
  }

  // 恢复测量缓存
  function restoreCache(cachedHeights) {
    if (cachedHeights instanceof Map) {
      rowHeights = new Map(cachedHeights);
    }
  }

  // 导出测量缓存
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
    getVirtualItems: () => virtualizer.getVirtualItems(),
  };
}
