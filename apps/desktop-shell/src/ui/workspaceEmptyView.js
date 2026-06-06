import {
  countRestorableActiveHistoryItems,
  projectWorkspaceEmptyCopy,
} from "../state/workspaceStatusProjection.js";

// 工作区空态文案只依赖 Session 与 History 快照，DOM 写入集中在这个 View。
export function createWorkspaceEmptyView({
  element,
  getSessionsSnapshot,
  getArchivedSessions,
  t,
}) {
  function renderWorkspaceEmptyCopy() {
    const restorableCount = countRestorableActiveHistoryItems({
      sessions: getSessionsSnapshot(),
      archivedSessions: getArchivedSessions(),
    });
    const copy = projectWorkspaceEmptyCopy({ restorableCount });
    const titleEl = element.querySelector("strong");
    const textEl = element.querySelector("p");
    if (!titleEl || !textEl) return;
    titleEl.textContent = t(copy.titleKey);
    textEl.textContent = t(copy.textKey);
    titleEl.dataset.i18n = copy.titleKey;
    textEl.dataset.i18n = copy.textKey;
  }

  return { renderWorkspaceEmptyCopy };
}
