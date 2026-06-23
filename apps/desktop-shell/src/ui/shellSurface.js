// Shell Surface 是控制器与具体 DOM 渲染函数之间的窄接口。
// 控制器只表达刷新意图，具体刷新哪个 View 仍由启动层注入。
export function createShellSurface({
  renderProviders = () => {},
  renderWorkspace = () => {},
  renderHistory = () => {},
  renderWorkspaceStatus = () => {},
  renderWorkspaceEmptyCopy = () => {},
  updateActionLabels = () => {},
  focusComposerInput = () => {},
} = {}) {
  function refresh(options = {}) {
    if (options.actions) updateActionLabels();
    if (options.providers) renderProviders();
    if (options.workspaceStatus) renderWorkspaceStatus();
    if (options.workspaceEmpty) renderWorkspaceEmptyCopy();
    if (options.workspace) renderWorkspace(options.workspaceOptions || {});
    if (options.history) renderHistory(options.historyOptions || {});
    if (options.focusComposer) focusComposerInput();
  }

  return {
    refresh,
    refreshProviders: () => renderProviders(),
    refreshWorkspace: (options) => renderWorkspace(options || {}),
    refreshHistory: (options) => renderHistory(options || {}),
    refreshWorkspaceStatus: () => renderWorkspaceStatus(),
    refreshWorkspaceEmpty: () => renderWorkspaceEmptyCopy(),
    refreshActions: () => updateActionLabels(),
    focusComposer: () => focusComposerInput(),
  };
}
