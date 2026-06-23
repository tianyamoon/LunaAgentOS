// Agent Fleet 视图只负责左侧入口列表的渲染与事件绑定。
// Provider 探测、目标选择和弹窗行为通过回调注入，避免视图直接持有领域状态。
export function createAgentFleetView({
  agentList,
  providersSnapshot,
  ensureCurrentTargetAgentExists,
  providerAvailability,
  providerStatusForFleet,
  runtimeInstancesForProvider,
  targetsForProvider,
  providerMetaLabel,
  providerRuntimeMiniLabel,
  renderProviderIcon,
  targetBriefText,
  displayAgentName,
  targetStatusForFleet,
  targetSendBlockNotice,
  isTargetSendable,
  isTargetActivatable,
  isTargetSelectable,
  agentById,
  getCurrentTargetAgentId,
  collapsedProviderIds,
  toggleProviderCollapsed,
  openProviderManager,
  openAgentManager,
  setCurrentTargetAgent,
  setAppNotice,
  t,
  escapeHtml,
  documentRoot = document,
}) {
  // 单个 Agent Entry 的 HTML 在此集中生成，保持 Fleet 主渲染流程易读。
  function renderRuntimeTarget(target) {
    const sendable = isTargetSendable(target);
    const activatable = isTargetActivatable(target);
    const selectable = sendable || activatable;
    const selected = selectable && target.id === getCurrentTargetAgentId();
    const status = target.status || targetStatusForFleet(target);
    const statusLabel = t(status.labelKey);
    const subtitle = targetBriefText(target);
    const name = displayAgentName(target);
    const shouldShowRuntimeLabel = target.runtimeLabel && !name.includes(target.runtimeLabel);
    const entryClass = selected ? "is-main-agent" : selectable ? "is-selectable" : "is-unavailable";
    const disabledAttrs = selectable
      ? ""
      : ` aria-disabled="true" title="${escapeHtml(targetSendBlockNotice(target))}"`;
    return `
      <div class="agent-entry ${entryClass}" data-agent-id="${target.id}" data-sendable="${String(sendable)}" data-selectable="${String(selectable)}"${disabledAttrs}>
        <div class="agent-entry-top">
          <strong>${escapeHtml(name)}</strong>
          <span class="agent-entry-meta">
            <span class="target-status-dot ${escapeHtml(status.className)}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}"></span>
            ${shouldShowRuntimeLabel ? `<span class="target-runtime-label">${escapeHtml(target.runtimeLabel)}</span>` : ""}
            <button type="button" class="agent-manage-btn" data-agent-id="${escapeHtml(target.id)}" title="${t("agentDetail.button")}" aria-label="${t("agentDetail.button")}">⚙</button>
          </span>
        </div>
        ${subtitle ? `<div class="agent-entry-sub">${escapeHtml(subtitle)}</div>` : ""}
      </div>
    `;
  }

  // 每次重绘都从 Store 快照读取 Provider，避免视图长期持有可变对象。
  function renderProviders() {
    ensureCurrentTargetAgentExists();
    agentList.innerHTML = "";

    providersSnapshot().forEach((provider) => {
      const group = documentRoot.createElement("section");
      const availability = providerAvailability(provider.id);
      const providerStatus = providerStatusForFleet(provider, availability);
      const availabilityLabel = t(providerStatus.labelKey);
      const instances = runtimeInstancesForProvider(provider.id);
      const targets = targetsForProvider(provider.id);
      const metaLabel = providerMetaLabel(provider, targets, instances);
      const runtimeMiniLabel = providerRuntimeMiniLabel(instances);
      const targetMarkup = targets.map(renderRuntimeTarget).join("");
      const hasAvailableRuntime = instances.some((instance) => instance.available);
      const emptyLabel = hasAvailableRuntime
        ? t("provider.noTargets")
        : t(provider.noRuntimeKey || "provider.noRuntime");
      const collapsed = collapsedProviderIds.has(provider.id);
      const collapseLabel = collapsed
        ? t("provider.expand", { provider: provider.name })
        : t("provider.collapse", { provider: provider.name });
      group.className = `provider-group ${providerStatus.mutedCard ? "is-muted-status" : ""}`;
      group.classList.toggle("is-collapsed", collapsed);

      group.innerHTML = `
        <div class="provider-header">
          <button type="button" class="provider-collapse-btn" data-provider-id="${provider.id}" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="provider-targets-${provider.id}" aria-label="${escapeHtml(collapseLabel)}" title="${escapeHtml(collapseLabel)}">
            <span class="provider-collapse-caret" aria-hidden="true">▸</span>
            <div class="provider-heading">
              <div class="provider-title-row">
                <strong>${renderProviderIcon(provider, { size: "13px" })}${provider.name}</strong>
                <span class="provider-status-square ${providerStatus.className}" title="${escapeHtml(availabilityLabel)}" aria-label="${escapeHtml(availabilityLabel)}"></span>
              </div>
              <div class="provider-meta-row">
                <span class="provider-count-badge">${escapeHtml(metaLabel)}</span>
                ${runtimeMiniLabel ? `<span class="provider-runtime-mini">${escapeHtml(runtimeMiniLabel)}</span>` : ""}
              </div>
            </div>
          </button>
          <button type="button" class="mini-btn ghost-btn provider-manage-btn provider-connection-icon-btn" data-provider-id="${provider.id}" title="${t("common.manage")}" aria-label="${t("common.manage")}">⚙</button>
        </div>
        <div class="provider-targets" id="provider-targets-${provider.id}" ${collapsed ? "hidden" : ""}>
          ${targetMarkup || `<div class="runtime-instance-empty">${emptyLabel}</div>`}
        </div>
      `;

      agentList.appendChild(group);
    });

    // 折叠、管理和目标切换都通过命令回调返回上层。
    agentList.querySelectorAll(".provider-collapse-btn").forEach((button) => {
      button.addEventListener("click", () => {
        toggleProviderCollapsed(button.dataset.providerId);
      });
    });

    agentList.querySelectorAll(".provider-manage-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openProviderManager(button.dataset.providerId);
      });
    });

    agentList.querySelectorAll(".agent-manage-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openAgentManager(button.dataset.agentId);
      });
    });

    agentList.querySelectorAll(".agent-entry").forEach((entry) => {
      entry.addEventListener("click", () => {
        const agentId = entry.dataset.agentId;
        if (!agentId) return;
        const target = agentById(agentId);
        if (entry.dataset.selectable === "false" || !isTargetSelectable(target)) {
          setAppNotice(targetSendBlockNotice(target), "error");
          return;
        }
        if (target.id === getCurrentTargetAgentId()) return;
        setCurrentTargetAgent(agentId);
      });
    });
  }

  return {
    renderProviders,
  };
}
