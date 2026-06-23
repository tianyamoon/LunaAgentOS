import test from "node:test";
import assert from "node:assert/strict";

import { createAgentFleetView } from "./agentFleetView.js";

// 测试只提供 Fleet 渲染需要的最小 DOM，避免把浏览器实现细节带入单元测试。
function createRoot() {
  return {
    children: [],
    innerHTML: "",
    appendChild(child) {
      this.children.push(child);
    },
    querySelectorAll() {
      return [];
    },
  };
}

function createDocumentRoot() {
  return {
    createElement() {
      return {
        className: "",
        innerHTML: "",
        classList: {
          toggle() {},
        },
      };
    },
  };
}

test("agentFleetView: Provider 空状态文案由元数据决定", () => {
  const agentList = createRoot();
  const view = createAgentFleetView({
    agentList,
    providersSnapshot: () => [{ id: "demo", name: "Demo", noRuntimeKey: "provider.demo.empty" }],
    ensureCurrentTargetAgentExists() {},
    providerAvailability: () => ({ summary: "not_connected" }),
    providerStatusForFleet: () => ({ labelKey: "provider.notConnected", className: "is-not-connected" }),
    runtimeInstancesForProvider: () => [],
    targetsForProvider: () => [],
    providerMetaLabel: () => "0",
    providerRuntimeMiniLabel: () => "",
    renderProviderIcon: () => "",
    targetBriefText: () => "",
    displayAgentName: () => "",
    targetStatusForFleet: () => ({ labelKey: "provider.notConnected", className: "is-not-connected" }),
    targetSendBlockNotice: () => "",
    isTargetSendable: () => false,
    isTargetActivatable: () => false,
    isTargetSelectable: () => false,
    agentById: () => null,
    getCurrentTargetAgentId: () => null,
    collapsedProviderIds: new Set(),
    toggleProviderCollapsed() {},
    openProviderManager() {},
    openAgentManager() {},
    setCurrentTargetAgent() {},
    setAppNotice() {},
    t: (key) => key,
    escapeHtml: (value) => String(value),
    documentRoot: createDocumentRoot(),
  });

  view.renderProviders();

  assert.equal(agentList.children.length, 1);
  assert.match(agentList.children[0].innerHTML, /provider\.demo\.empty/);
});
