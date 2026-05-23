// Markdown rendering surface for LunaAgentOS.
//
// Wraps markdown-it with the project-specific:
// - code fence rule that emits the Luna code-block / mermaid-block markup
// - table rules that wrap the table in a scrollable container
// - normalization pre-pass for sloppy runtime markdown
// - DOMPurify sanitization on the final HTML
//
// Re-exports the smaller utilities so callers only need one import.

import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { t } from "../i18n/index.js";
import { escapeHtml, safeLinkHref } from "./escape.js";
import {
  normalizeLooseMarkdownTables,
  normalizeRuntimeMarkdown,
} from "./normalize.js";

export { escapeHtml, safeLinkHref } from "./escape.js";
export {
  closeStreamingMarkdown,
  hasMarkdownTable,
  isMarkdownTableSeparator,
  markdownTableCellCount,
  normalizeLooseMarkdownTables,
  normalizeRuntimeMarkdown,
  splitCollapsedMarkdownTableRows,
  transformOutsideCodeFences,
} from "./normalize.js";
export { loadMermaidRuntime, renderMermaidDiagrams } from "./mermaid.js";

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

markdownRenderer.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const lang = token.info.trim().split(/\s+/)[0] || "";
  return renderCodeFence(lang, token.content);
};

markdownRenderer.renderer.rules.table_open = () => "<div class=\"md-table-wrap\"><table class=\"md-table\">\n";
markdownRenderer.renderer.rules.table_close = () => "</table></div>\n";

export function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const safeHref = safeLinkHref(href);
      return safeHref ? `<a href="${safeHref}" target="_blank" rel="noreferrer noopener">${label}</a>` : label;
    });
}

export function isMarkdownTable(lines, index) {
  return lines[index]?.trim().startsWith("|")
    && lines[index + 1]?.trim().startsWith("|")
    && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1].trim());
}

export function renderMarkdownTable(lines) {
  const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  const header = cells(lines[0]);
  const alignments = cells(lines[1]).map((cell) => {
    const value = cell.trim();
    const left = value.startsWith(":");
    const right = value.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
  const headerHtml = header.map((cell, columnIndex) => `<th style="text-align:${alignments[columnIndex] || "left"}">${renderInlineMarkdown(cell)}</th>`).join("");
  const bodyHtml = lines.slice(2).map((line) => {
    const rowCells = cells(line);
    return `<tr>${rowCells.map((cell, columnIndex) => `<td style="text-align:${alignments[columnIndex] || "left"}">${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`;
  }).join("");
  return `
    <div class="md-table-wrap"><table class="md-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>
  `;
}

export function renderRichText(text) {
  const normalized = normalizeLooseMarkdownTables(normalizeRuntimeMarkdown(text));
  const html = markdownRenderer.render(normalized);
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel"],
  });
}

export function renderCodeFence(lang, code) {
  const normalizedLang = lang.trim().toLowerCase();
  if (normalizedLang === "mermaid") {
    return `
      <div class="md-diagram-block">
        <div class="md-code-toolbar">
          <span class="md-code-lang">mermaid</span>
          <button type="button" class="mini-btn ghost-btn md-code-copy-btn">${t("markdown.copySource")}</button>
        </div>
        <div class="md-diagram-render" aria-label="${t("markdown.diagramPreview")}">
          <span class="caption">${t("markdown.diagramRendering")}</span>
        </div>
        <div class="md-diagram-fallback">
          <strong>${t("markdown.diagramSource")}</strong>
          <p>${t("markdown.diagramFallback")}</p>
        </div>
        <pre class="md-code"><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  }
  return `
    <div class="md-code-block">
      <div class="md-code-toolbar">
        ${lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : "<span></span>"}
        <button type="button" class="mini-btn ghost-btn md-code-copy-btn">${t("markdown.copyCode")}</button>
      </div>
      <pre class="md-code"><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}
