import { t } from "../../i18n/index.js";
import { escapeHtml } from "./healthText.js";
import { REPAIR_ACTION_TYPE } from "../../state/repairActions.js";

// 把修复动作渲染为可点击按钮。所有 payload 经 escapeHtml 写入 data-* 属性，
// 事件在 innerHTML 注入后由 agentManagementView 的 bindRepairActions 统一绑定。
export function renderRepairActions(actions = []) {
  if (!Array.isArray(actions) || !actions.length) return "";
  const buttons = actions
    .map((action) => {
      const label = escapeHtml(t(action.labelKey));
      const attrs = [`data-repair-action="${escapeHtml(action.type)}"`];
      if (action.type === REPAIR_ACTION_TYPE.copy_command) {
        attrs.push(`data-repair-command="${escapeHtml(action.command)}"`);
      } else if (action.type === REPAIR_ACTION_TYPE.open_dialog) {
        attrs.push(`data-repair-dialog="${escapeHtml(action.dialog)}"`);
        attrs.push(`data-repair-provider="${escapeHtml(action.providerId)}"`);
      } else if (action.type === REPAIR_ACTION_TYPE.reprobe) {
        attrs.push(`data-repair-provider="${escapeHtml(action.providerId)}"`);
      }
      return `<button type="button" class="mini-btn ghost-btn health-repair-action" ${attrs.join(" ")}>${label}</button>`;
    })
    .join("");
  return `<div class="health-repair-actions">${buttons}</div>`;
}
