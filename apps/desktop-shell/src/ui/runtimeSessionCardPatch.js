// Runtime Session Card 外壳补丁。
// 流式刷新只同步外壳属性与 Header，正文 MessageList 由独立 seam 维护。
// 流式路径使用 patchSessionCardFromViewModel 直接更新，不生成完整 HTML。
const ARTICLE_ATTRS = ["tabindex", "aria-label", "aria-current"];

// 流式路径：从 viewModel 直接 patch Card 外壳，不生成完整 HTML。
export function patchSessionCardFromViewModel(card, viewModel) {
  if (!card || !viewModel) return null;
  patchArticleFromViewModel(card, viewModel);
  patchHeaderFromViewModel(card, viewModel);
  return card.querySelector?.(".session-card-body") || null;
}

// 兼容旧路径：从完整 sourceArticle 提取差异后 patch。
export function patchSessionCardShell(card, sourceArticle, { reconcileBody } = {}) {
  if (!card || !sourceArticle) return null;
  patchArticleIdentity(card, sourceArticle);
  patchHeader(card, sourceArticle);
  const body = patchStableBody(card, sourceArticle, reconcileBody);
  return body;
}

function patchArticleFromViewModel(card, vm) {
  card.className = vm.className || "";
  if (vm.ariaLabel != null) card.setAttribute?.("aria-label", vm.ariaLabel);
  else card.removeAttribute?.("aria-label");
  if (vm.ariaCurrent != null) card.setAttribute?.("aria-current", vm.ariaCurrent);
  else card.removeAttribute?.("aria-current");
  card.setAttribute?.("tabindex", "0");
}

function patchHeaderFromViewModel(card, vm) {
  const header = card.querySelector?.(".session-card-header");
  if (!header || !vm.headerHtml) return;
  if (header.dataset.shellDigest !== vm.headerDigest) {
    header.innerHTML = vm.headerHtml;
    header.dataset.shellDigest = vm.headerDigest || "";
  }
}

function patchArticleIdentity(card, sourceArticle) {
  card.className = sourceArticle.className || "";
  for (const attr of ARTICLE_ATTRS) {
    const value = sourceArticle.getAttribute?.(attr);
    if (value === null || value === undefined) card.removeAttribute?.(attr);
    else card.setAttribute?.(attr, value);
  }
}

function patchHeader(card, sourceArticle) {
  const currentHeader = card.querySelector?.(".session-card-header");
  const nextHeader = sourceArticle.querySelector?.(".session-card-header");
  if (!currentHeader || !nextHeader) return;
  if (currentHeader.innerHTML !== nextHeader.innerHTML) currentHeader.innerHTML = nextHeader.innerHTML;
}

function patchStableBody(card, sourceArticle, reconcileBody) {
  const currentBody = card.querySelector?.(".session-card-body") || null;
  const nextBody = sourceArticle.querySelector?.(".session-card-body") || null;
  if (!currentBody || !nextBody) return currentBody || nextBody;
  if (reconcileBody) reconcileBody(currentBody, nextBody);
  else if (currentBody.innerHTML !== nextBody.innerHTML) currentBody.innerHTML = nextBody.innerHTML;
  return currentBody;
}
