import { AvailabilityView } from "../components/availability/AvailabilityView.js";
import { AgentDetailPanel } from "../components/agentDetail/AgentDetailPanel.js";
import { buildAgentDetail } from "../providers/agentDetail.js";
import { deriveTargetHealth } from "../state/agentHealth.js";
import { isTargetActivatable } from "../state/targetActivation.js";

// Agent 管理视图统一承接连接详情、职责简报和可用性弹窗。
// 运行时探测、配置持久化和 Session 执行通过命令回调注入。
export function createAgentManagementView({
  confirmDialog,
  getAvailabilityStore,
  providersSnapshot,
  runtimeInstancesSnapshot,
  getRuntimeAvailabilitySnapshot,
  currentTargetAgent,
  getDefaultProviderId,
  providerById,
  agentById,
  runtimeInstanceById,
  runtimeInstancesForProvider,
  targetsForProvider,
  providerAvailability,
  providerAvailabilityLabel,
  providerAvailabilityState,
  runtimeConnectionNote,
  targetDisplayName,
  displayAgentName,
  targetBriefText,
  targetBriefInputValue,
  fallbackBriefKeyForTarget,
  isTargetSendable,
  cloneAgentBriefs,
  writeBriefValue,
  saveAgentBriefRecords,
  saveDefaultModel,
  defaultModelForTarget,
  ensureRuntimeConfigState,
  refreshAgentBriefForTarget,
  refreshRuntimeProbe,
  refreshProviderConnections,
  discoverModelControl,
  renderProviders,
  closeConfirmDialog,
  setAppNotice,
  formatBackendError,
  stateClasses,
  t,
  escapeHtml,
  clipboard = globalThis.navigator?.clipboard,
}) {
  // Runtime 卡片只展示探测结果，不推断 Adapter 内部机制。
  function runtimeInstanceDetailMarkup(instance) {
    const lines = [];
    const addLine = (value) => {
      const text = String(value || "").trim();
      if (text && !lines.includes(text)) lines.push(text);
    };
    String(instance.detail || "")
      .split(/\r?\n/)
      .forEach(addLine);
    addLine(instance.version);
    return lines.map((line) => `<small>${escapeHtml(line)}</small>`).join("");
  }

  function connectionInstanceMarkup(instance, title = "") {
    const state = instance.available ? 1 : 9;
    return `
      <article class="connection-instance-card">
        <div class="connection-instance-top">
          <strong>${escapeHtml(instance.runtimeLabel || title)}</strong>
          <span class="state-pill ${stateClasses[state] || "state-idle"}">${instance.available ? t("provider.available") : t("provider.notConnected")}</span>
        </div>
        <p>${escapeHtml(instance.summary || "")}</p>
        ${runtimeInstanceDetailMarkup(instance)}
      </article>
    `;
  }

  // 简报行同时服务单个 Agent 和整个 Provider 的批量编辑弹窗。
  function agentBriefRowMarkup(target, index) {
    const sendable = isTargetSendable(target);
    return `
      <article class="agent-brief-row" data-agent-id="${escapeHtml(target.id)}">
        <div class="agent-brief-row-header">
          <strong>${escapeHtml(targetDisplayName(target) || displayAgentName(target))}</strong>
          <button type="button" class="mini-btn ghost-btn agent-brief-row-fetch" data-agent-id="${escapeHtml(target.id)}" ${sendable ? "" : "disabled"}>${t("agentBrief.autoFetch")}</button>
        </div>
        <label>
          <span>${t("agentBrief.zhLabel")}</span>
          <input class="agent-brief-input" data-agent-id="${escapeHtml(target.id)}" data-language="zh-CN" name="brief-${index}-zh" value="${escapeHtml(targetBriefInputValue(target, "zh-CN"))}" placeholder="${escapeHtml(t(fallbackBriefKeyForTarget(target)))}" />
        </label>
        <label>
          <span>${t("agentBrief.enLabel")}</span>
          <input class="agent-brief-input" data-agent-id="${escapeHtml(target.id)}" data-language="en-US" name="brief-${index}-en" value="${escapeHtml(targetBriefInputValue(target, "en-US"))}" placeholder="${escapeHtml(t("agentBrief.placeholderEn"))}" />
        </label>
      </article>
    `;
  }

  // 表单保存时重新按 Agent Entry 查找目标，避免长期持有旧探测快照。
  async function saveBriefInputs(root) {
    const next = cloneAgentBriefs();
    root.querySelectorAll(".agent-brief-input").forEach((input) => {
      const target = agentById(input.dataset.agentId);
      if (!target) return;
      writeBriefValue(next, target, input.dataset.language, input.value, "manual");
    });
    await saveAgentBriefRecords(next);
    renderProviders();
  }

  function briefInputFor(root, targetId, language) {
    return [...root.querySelectorAll(".agent-brief-input")]
      .find((input) => input.dataset.agentId === targetId && input.dataset.language === language) || null;
  }

  // 自动获取按钮会把 Session 返回结果同步回当前表单。
  function bindAutoFetchBriefButtons(root) {
    root.querySelectorAll(".agent-brief-row-fetch").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = agentById(button.dataset.agentId);
        if (!target) return;
        button.disabled = true;
        try {
          const result = await refreshAgentBriefForTarget(target);
          const zhInput = briefInputFor(root, target.id, "zh-CN");
          const enInput = briefInputFor(root, target.id, "en-US");
          if (zhInput) zhInput.value = result["zh-CN"];
          if (enInput) enInput.value = result["en-US"];
        } catch (error) {
          console.error(error);
          setModalStatus(root, t("agentBrief.fetchFailed", { error: formatBackendError(error) }), "error");
        } finally {
          button.disabled = !isTargetSendable(target);
        }
      });
    });
  }

  async function autoFetchProviderBriefs(providerId, root) {
    const targets = targetsForProvider(providerId).filter(isTargetSendable);
    if (!targets.length) {
      setModalStatus(root, t("agentBrief.noSendableTargets"), "error");
      return;
    }
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      setModalStatus(root, t("agentBrief.fetchingProgress", {
        current: index + 1,
        total: targets.length,
        target: targetDisplayName(target),
      }), "busy");
      const result = await refreshAgentBriefForTarget(target, { quiet: true });
      const zhInput = briefInputFor(root, target.id, "zh-CN");
      const enInput = briefInputFor(root, target.id, "en-US");
      if (zhInput) zhInput.value = result["zh-CN"];
      if (enInput) enInput.value = result["en-US"];
    }
    setModalStatus(root, t("agentBrief.fetchAllComplete", { count: targets.length }), "ok");
  }

  // 模态内状态行：重新探测/复制等模态内操作的反馈写在弹窗操作区，
  // 不再用主窗口顶部的 setAppNotice（会被模态遮罩盖住，用户看不到）。
  // 在最小 DOM 壳（测试）下 querySelector 返回 null 时安全跳过。
  function setModalStatus(root, message, tone = "") {
    if (!root || typeof root.querySelector !== "function") return;
    const actions = root.querySelector(".confirm-dialog-actions");
    if (!actions) return;
    let status = actions.querySelector(".modal-action-status");
    if (!status) {
      status = root.ownerDocument?.createElement?.("span");
      if (!status) return;
      status.className = "modal-action-status";
      actions.insertBefore(status, actions.firstChild);
    }
    status.textContent = message || "";
    status.classList.remove("is-busy", "is-error", "is-ok");
    if (tone) status.classList.add(`is-${tone}`);
  }

  // 修复按钮事件统一绑定：复制命令、跳转连接弹窗、重新探测。
  // 全部为前端动作，不执行任何进程。onReprobe 让各弹窗在重新探测后自行重渲染。
  // 反馈写入所在模态的状态行，避免飘到被遮罩盖住的顶部通知条。
  function bindRepairActions(root, { onReprobe } = {}) {
    root.querySelectorAll(".health-repair-action").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.repairAction;
        if (action === "copy_command") {
          try {
            await clipboard?.writeText(button.dataset.repairCommand || "");
            setModalStatus(root, t("availability.repairAction.copied"), "ok");
          } catch (error) {
            console.error(error);
            setModalStatus(root, t("common.copyFailed"), "error");
          }
          return;
        }
        if (action === "open_dialog") {
          openProviderManager(button.dataset.repairProvider || undefined);
          return;
        }
        if (action === "reprobe") {
          button.disabled = true;
          setModalStatus(root, t("availability.rechecking"), "busy");
          try {
            await refreshProviderConnections(button.dataset.repairProvider || undefined);
            // onReprobe 可能重渲染整个模态，先重渲染再写"完成"，使其落在新 DOM 上。
            await onReprobe?.();
            setModalStatus(root, t("availability.checkComplete"), "ok");
          } catch (error) {
            console.error(error);
            button.disabled = false;
            setModalStatus(root, t("availability.checkFailed", { error: formatBackendError(error) }), "error");
          }
        }
      });
    });
  }

  // Agent Detail 使用 availability 快照补充健康信息，不自行发起探测。
  function availabilityTargetForAgent(target) {
    if (!target) return null;
    const store = getAvailabilityStore();
    const data = store.refresh(
      providersSnapshot(),
      runtimeInstancesSnapshot(),
      currentTargetAgent(),
      getRuntimeAvailabilitySnapshot(),
    );
    const provider = data.providers.find((entry) => entry.id === target.providerId);
    const found = provider?.targets.find((entry) => entry.id === target.id);
    if (found) return found;
    // 运行时探测出的 target（如 Hermes WSL/Win profile）不在 provider.agents 静态列表里，
    // store 查不到。就地用 deriveTargetHealth 归一化：补齐 overall + diagnostics，
    // 并把可发送/可连接判断转成明确的状态+原因+修复，避免回退到裸后端 health 导致
    // 健康区显示空白的"状态未知"。deriveTargetHealth 内部会吸收 target 上已有的 health 字段。
    return {
      health: deriveTargetHealth(target, {
        sendable: isTargetSendable(target),
        activatable: isTargetActivatable(target),
      }),
    };
  }

  async function openAgentManager(agentId) {
    const target = agentById(agentId);
    if (!target || !confirmDialog) return;
    try {
      await ensureRuntimeConfigState();
      const provider = providerById(target.providerId) || { id: target.providerId, name: target.providerName || target.providerId };
      const runtimeInstance = runtimeInstanceById(target.runtimeInstanceId);
      const discoveredModelControl = runtimeInstance?.modelControl
        || target.modelControl
        || provider.modelControl
        || provider.adapterManifest?.modelControl;
      const managedTarget = { ...target, modelControl: discoveredModelControl || { mode: "native_runtime" } };
      const detail = buildAgentDetail({
        target: {
          ...managedTarget,
          name: targetDisplayName(target) || displayAgentName(target),
        },
        provider,
        runtimeInstance,
        availabilityTarget: availabilityTargetForAgent(target),
        agentBrief: targetBriefText(target),
        savedDefaultModel: defaultModelForTarget(target),
      });
      const title = detail.name || targetDisplayName(target);
      const instances = runtimeInstance
        ? [runtimeInstance]
        : runtimeInstancesForProvider(target.providerId);
      const instanceMarkup = instances.length
        ? instances.map((instance) => connectionInstanceMarkup(instance, detail.providerName)).join("")
        : `<p class="connection-empty">${t("connection.none")}</p>`;
      confirmDialog.hidden = false;
      confirmDialog.innerHTML = `
        <form class="confirm-dialog runtime-config-dialog agent-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="agentManagerTitle">
          <div class="confirm-dialog-header">
            <span class="runtime-config-icon" aria-hidden="true">●</span>
            <div>
              <h3 id="agentManagerTitle">${t("agentDetail.title")} · ${escapeHtml(title)}</h3>
              <p class="runtime-config-subtitle">${t("agentDetail.subtitle")}</p>
            </div>
            <button type="button" class="confirm-dialog-close agent-manager-close" aria-label="${t("common.close")}">×</button>
          </div>
          <div class="runtime-config-body agent-manager-body dialog-tabs">
            <input class="dialog-tab-input" type="radio" name="agent-manager-tab" id="agentManagerTabOverview" checked>
            <label class="dialog-tab-label" for="agentManagerTabOverview">${t("agentDetail.tab.overview")}</label>
            <input class="dialog-tab-input" type="radio" name="agent-manager-tab" id="agentManagerTabBrief">
            <label class="dialog-tab-label" for="agentManagerTabBrief">${t("agentDetail.tab.brief")}</label>
            <input class="dialog-tab-input" type="radio" name="agent-manager-tab" id="agentManagerTabConnection">
            <label class="dialog-tab-label" for="agentManagerTabConnection">${t("agentDetail.tab.connection")}</label>
            <div class="dialog-tab-panels">
              <section class="dialog-tab-panel agent-manager-overview">${AgentDetailPanel(detail)}</section>
              <section class="dialog-tab-panel agent-manager-brief">
                <div class="runtime-config-section agent-brief-section">
                  <div class="agent-brief-section-header">
                    <div>
                      <h4>${t("agentBrief.sectionTitle")}</h4>
                      <p>${t("agentBrief.sectionSubtitle")}</p>
                    </div>
                  </div>
                  <div class="agent-brief-list">${agentBriefRowMarkup(target, 0)}</div>
                </div>
              </section>
              <section class="dialog-tab-panel agent-manager-connection">
                <div class="runtime-config-section">
                  <h4>${t("connection.detected")}</h4>
                  <div class="connection-instance-list">${instanceMarkup}</div>
                </div>
              </section>
            </div>
          </div>
          <div class="confirm-dialog-actions runtime-config-actions">
            <button type="button" class="confirm-dialog-cancel agent-manager-close">${t("common.close")}</button>
            <button type="button" class="mini-btn ghost-btn agent-manager-recheck">${t("connection.recheck")}</button>
            <button type="submit" class="primary runtime-config-save">${t("agentBrief.saveAll")}</button>
          </div>
        </form>
      `;
      confirmDialog.querySelectorAll(".agent-manager-close").forEach((button) => {
        button.addEventListener("click", closeConfirmDialog);
      });
      bindAutoFetchBriefButtons(confirmDialog);
      bindRepairActions(confirmDialog, { onReprobe: () => openAgentManager(agentId) });
      confirmDialog.querySelector(".agent-default-model-save")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const select = confirmDialog.querySelector(".agent-default-model-select");
        button.disabled = true;
        try {
          await saveDefaultModel(managedTarget, select?.value || "");
          // openAgentManager 重渲染整个模态，先重渲染再写"已保存"，使其落在新 DOM 上。
          await openAgentManager(agentId);
          setModalStatus(confirmDialog, t("agentDetail.modelSaved"), "ok");
        } catch (error) {
          console.error(error);
          button.disabled = false;
          setModalStatus(confirmDialog, t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
        }
      });
      confirmDialog.querySelector(".agent-manager-recheck")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        setModalStatus(confirmDialog, t("connection.rechecking"), "busy");
        try {
          await refreshProviderConnections(target.providerId);
          const refreshedTarget = agentById(agentId) || target;
          const refreshedInstance = runtimeInstanceById(refreshedTarget.runtimeInstanceId);
          if (refreshedInstance?.available && typeof discoverModelControl === "function") {
            await discoverModelControl(refreshedTarget);
          }
          await openAgentManager(agentId);
          setModalStatus(confirmDialog, t("connection.checkComplete"), "ok");
        } catch (error) {
          console.error(error);
          button.disabled = false;
          setModalStatus(confirmDialog, t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
        }
      });
      confirmDialog.querySelector(".agent-manager-dialog")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveBriefInputs(confirmDialog);
        closeConfirmDialog();
        setAppNotice(t("agentBrief.saved"));
      });
    } catch (error) {
      console.error(error);
      setAppNotice(t("agentDetail.openFailed", { error: formatBackendError(error) }), "error");
    }
  }

  function providerBriefSectionMarkup(providerId) {
    const targets = targetsForProvider(providerId);
    const rows = targets.map(agentBriefRowMarkup).join("");
    return `
      <section class="runtime-config-section agent-brief-section">
        <div class="agent-brief-section-header">
          <div>
            <h4>${t("agentBrief.sectionTitle")}</h4>
            <p>${t("agentBrief.sectionSubtitle")}</p>
          </div>
          <button type="button" class="mini-btn ghost-btn agent-brief-fetch-all" ${targets.some(isTargetSendable) ? "" : "disabled"}>${t("agentBrief.autoFetchAll")}</button>
        </div>
        <div class="agent-brief-list">${rows || `<p class="connection-empty">${t("provider.noTargets")}</p>`}</div>
        <button type="button" class="mini-btn agent-brief-save-all">${t("agentBrief.saveAll")}</button>
      </section>
    `;
  }

  async function openProviderManager(providerId = getDefaultProviderId()) {
    if (!confirmDialog) return;
    try {
      const selectedProviderId = providerId || getDefaultProviderId();
      if (!selectedProviderId) return;
      await ensureRuntimeConfigState();
      const selectedProvider = providerById(selectedProviderId) || { id: selectedProviderId, name: selectedProviderId };
      const selectedAvailability = providerAvailability(selectedProviderId);
      const selectedState = providerAvailabilityLabel(selectedAvailability.summary);
      const selectedStateClass = stateClasses[providerAvailabilityState(selectedAvailability.summary)] || "state-idle";
      const title = selectedProvider.name;
      const instances = runtimeInstancesForProvider(selectedProviderId);
      const instanceMarkup = instances.length
        ? instances.map((instance) => connectionInstanceMarkup(instance, title)).join("")
        : `<p class="connection-empty">${t("connection.none")}</p>`;
      confirmDialog.hidden = false;
      confirmDialog.innerHTML = `
        <form class="confirm-dialog runtime-config-dialog connection-dialog" role="dialog" aria-modal="true" aria-labelledby="runtimeConfigTitle">
          <div class="confirm-dialog-header">
            <span class="runtime-config-icon" aria-hidden="true">●</span>
            <div>
              <h3 id="runtimeConfigTitle">${t("connection.title")} · ${escapeHtml(title)}</h3>
              <p class="runtime-config-subtitle">${t("connection.subtitle")}</p>
            </div>
            <button type="button" class="confirm-dialog-close runtime-config-close" aria-label="${t("common.close")}">×</button>
          </div>
          <div class="runtime-config-body connection-manager-body dialog-tabs">
            <aside class="runtime-config-status-card">
              <span class="runtime-config-kicker">${escapeHtml(selectedProviderId)}</span>
              <strong>${escapeHtml(title)}</strong>
              <span class="state-pill ${selectedStateClass}">${selectedState}</span>
              <span>${escapeHtml(runtimeConnectionNote(selectedProvider, instances))}</span>
            </aside>
            <input class="dialog-tab-input" type="radio" name="provider-manager-tab" id="providerManagerTabConnection" checked>
            <label class="dialog-tab-label" for="providerManagerTabConnection">${t("agentDetail.tab.connection")}</label>
            <input class="dialog-tab-input" type="radio" name="provider-manager-tab" id="providerManagerTabBrief">
            <label class="dialog-tab-label" for="providerManagerTabBrief">${t("agentDetail.tab.brief")}</label>
            <div class="dialog-tab-panels">
              <section class="dialog-tab-panel provider-connection-tab">
                <div class="runtime-config-section">
                  <h4>${t("connection.detected")}</h4>
                  <div class="connection-instance-list">${instanceMarkup}</div>
                </div>
              </section>
              <section class="dialog-tab-panel provider-brief-tab">${providerBriefSectionMarkup(selectedProviderId)}</section>
            </div>
          </div>
          <div class="confirm-dialog-actions runtime-config-actions">
            <button type="button" class="confirm-dialog-cancel runtime-config-close">${t("common.close")}</button>
            <button type="submit" class="primary runtime-config-save">${t("connection.recheck")}</button>
          </div>
        </form>
      `;
      confirmDialog.querySelectorAll(".runtime-config-close").forEach((button) => {
        button.addEventListener("click", closeConfirmDialog);
      });
      bindAutoFetchBriefButtons(confirmDialog);
      confirmDialog.querySelector(".agent-brief-save-all")?.addEventListener("click", async () => {
        try {
          await saveBriefInputs(confirmDialog);
          setModalStatus(confirmDialog, t("agentBrief.saved"), "ok");
        } catch (error) {
          console.error(error);
          setModalStatus(confirmDialog, t("agentBrief.saveFailed", { error: formatBackendError(error) }), "error");
        }
      });
      confirmDialog.querySelector(".agent-brief-fetch-all")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          await autoFetchProviderBriefs(selectedProviderId, confirmDialog);
        } catch (error) {
          console.error(error);
          setModalStatus(confirmDialog, t("agentBrief.fetchFailed", { error: formatBackendError(error) }), "error");
        } finally {
          button.disabled = !targetsForProvider(selectedProviderId).some(isTargetSendable);
        }
      });
      confirmDialog.querySelector(".runtime-config-dialog")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const saveButton = event.currentTarget.querySelector(".runtime-config-save");
        saveButton.disabled = true;
        setModalStatus(confirmDialog, t("connection.rechecking"), "busy");
        try {
          await refreshProviderConnections(selectedProviderId);
          // 重新探测后重开弹窗以就地刷新结果，反馈留在模态内。
          await openProviderManager(selectedProviderId);
          setModalStatus(confirmDialog, t("connection.checkComplete"), "ok");
        } catch (error) {
          console.error(error);
          saveButton.disabled = false;
          setModalStatus(confirmDialog, t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
        }
      });
    } catch (error) {
      console.error(error);
      setAppNotice(t("runtimeConfig.failed", { error: formatBackendError(error) }), "error");
    }
  }

  // 可用性弹窗共享 Store 中的健康快照，只在用户点击重查时触发探测。
  function openAvailabilityModal() {
    if (!confirmDialog) return;
    const store = getAvailabilityStore();
    const data = store.getData();
    if (!data.lastCheck) {
      store.refresh(providersSnapshot(), runtimeInstancesSnapshot(), currentTargetAgent(), getRuntimeAvailabilitySnapshot());
    }
    const freshData = store.getData();
    confirmDialog.hidden = false;
    confirmDialog.innerHTML = `
      <form class="confirm-dialog availability-dialog" role="dialog" aria-modal="true" aria-labelledby="availabilityTitle">
        <div class="confirm-dialog-header">
          <span class="runtime-config-icon" aria-hidden="true">●</span>
          <div>
            <h3 id="availabilityTitle">${t("availability.title")}</h3>
            <p class="runtime-config-subtitle">${t("availability.subtitle")}</p>
          </div>
          <button type="button" class="confirm-dialog-close availability-close" aria-label="${t("common.close")}">×</button>
        </div>
        <div class="availability-dialog-body">${AvailabilityView(freshData, { showTitle: false, compact: true })}</div>
        <div class="confirm-dialog-actions availability-actions">
          <button type="button" class="confirm-dialog-cancel availability-close">${t("common.close")}</button>
          <button type="button" class="mini-btn ghost-btn availability-copy">${t("availability.copyReport")}</button>
          <button type="submit" class="primary availability-recheck">${t("availability.recheck")}</button>
        </div>
      </form>
    `;
    // 重新探测后重渲染弹窗主体，并重新绑定其中的修复按钮。
    function renderAvailabilityBody() {
      store.refresh(providersSnapshot(), runtimeInstancesSnapshot(), currentTargetAgent(), getRuntimeAvailabilitySnapshot());
      const body = confirmDialog.querySelector(".availability-dialog-body");
      if (body) body.innerHTML = AvailabilityView(store.getData(), { showTitle: false, compact: true });
      bindRepairActions(confirmDialog, { onReprobe: renderAvailabilityBody });
    }
    confirmDialog.querySelectorAll(".availability-close").forEach((button) => {
      button.addEventListener("click", closeConfirmDialog);
    });
    bindRepairActions(confirmDialog, { onReprobe: renderAvailabilityBody });
    confirmDialog.querySelector(".availability-copy")?.addEventListener("click", () => {
      clipboard?.writeText(JSON.stringify(freshData, null, 2)).then(() => {
        setModalStatus(confirmDialog, t("availability.reportCopied"), "ok");
      }).catch(() => {
        setModalStatus(confirmDialog, t("common.copyFailed"), "error");
      });
    });
    confirmDialog.querySelector(".availability-dialog")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const recheckBtn = event.currentTarget.querySelector(".availability-recheck");
      recheckBtn.disabled = true;
      setModalStatus(confirmDialog, t("availability.rechecking"), "busy");
      try {
        await refreshRuntimeProbe();
        renderAvailabilityBody();
        setModalStatus(confirmDialog, t("availability.checkComplete"), "ok");
      } catch (error) {
        setModalStatus(confirmDialog, t("availability.checkFailed", { error: formatBackendError(error) }), "error");
      } finally {
        recheckBtn.disabled = false;
      }
    });
  }

  return {
    openAgentManager,
    openAvailabilityModal,
    openProviderManager,
  };
}
