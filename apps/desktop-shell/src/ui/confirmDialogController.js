import { escapeHtml } from "../markdown/index.js";

export function createConfirmDialogController({
  element = null,
  translate = (key) => key,
} = {}) {
  let pendingConfirmAction = null;

  function close() {
    pendingConfirmAction = null;
    if (!element) return;
    element.hidden = true;
    element.innerHTML = "";
  }

  async function confirmAndClose() {
    const action = pendingConfirmAction;
    close();
    if (action) await action();
  }

  function open({ title, message, confirmLabel = translate("common.delete"), onConfirm } = {}) {
    if (!element) return;
    pendingConfirmAction = onConfirm;
    element.hidden = false;
    // 通用确认弹窗只负责短确认流，复杂 Agent 管理弹窗仍由对应 View 接管。
    element.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
        <div class="confirm-dialog-header">
          <span class="confirm-dialog-icon" aria-hidden="true">!</span>
          <h3 id="confirmDialogTitle">${escapeHtml(title)}</h3>
          <button type="button" class="confirm-dialog-close" aria-label="${translate("common.close")}">×</button>
        </div>
        <p class="confirm-dialog-message">${escapeHtml(message)}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="mini-btn confirm-dialog-cancel">${translate("common.cancel")}</button>
          <button type="button" class="mini-btn confirm-dialog-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    element.querySelector(".confirm-dialog-close")?.addEventListener("click", close);
    element.querySelector(".confirm-dialog-cancel")?.addEventListener("click", close);
    element.querySelector(".confirm-dialog-confirm")?.addEventListener("click", confirmAndClose);
  }

  return {
    open,
    close,
  };
}
