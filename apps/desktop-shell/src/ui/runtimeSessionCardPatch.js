// Runtime Session Card 外壳补丁。
// 流式刷新只同步外壳属性与 Header，正文 MessageList 由独立 seam 维护。
const ARTICLE_ATTRS = ["tabindex", "aria-label", "aria-current"];

export function patchSessionCardShell(card, sourceArticle, { reconcileBody } = {}) {
  if (!card || !sourceArticle) return null;
  patchArticleIdentity(card, sourceArticle);
  patchHeader(card, sourceArticle);
  const body = patchStableBody(card, sourceArticle, reconcileBody);
  return body;
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
