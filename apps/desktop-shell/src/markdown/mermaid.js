// Mermaid runtime loader and incremental renderer.
//
// Mermaid is heavy (>1 MB) and only needed when the user actually views a
// diagram. We import it lazily on first use and cache the runtime promise
// so subsequent renders reuse the same instance.
//
// renderMermaidDiagrams is scoped to a root element so per-card streaming
// re-renders only touch that card's diagrams, not the whole workspace.

import DOMPurify from "dompurify";
import { t } from "../i18n/index.js";

let mermaidRuntimePromise = null;

export async function loadMermaidRuntime() {
  if (!mermaidRuntimePromise) {
    mermaidRuntimePromise = import("mermaid").then((module) => {
      const runtime = module.default;
      runtime.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          primaryColor: "#fbf6ec",
          primaryTextColor: "#2f2a24",
          primaryBorderColor: "#c7ad82",
          lineColor: "#7b6240",
          secondaryColor: "#f3ead9",
          tertiaryColor: "#fffaf0",
        },
      });
      return runtime;
    });
  }
  return mermaidRuntimePromise;
}

export async function renderMermaidDiagrams(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const blocks = [...root.querySelectorAll(".md-diagram-block:not([data-rendered])")];
  if (!blocks.length) return;
  const mermaid = await loadMermaidRuntime();
  for (const [index, block] of blocks.entries()) {
    const source = block.querySelector("code")?.textContent || "";
    const target = block.querySelector(".md-diagram-render");
    if (!source.trim() || !target) continue;
    try {
      const id = `luna-mermaid-${Date.now()}-${index}`;
      const { svg } = await mermaid.render(id, source);
      target.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      block.dataset.rendered = "true";
      block.classList.add("is-rendered");
    } catch (error) {
      console.error(error);
      target.innerHTML = `<span class="caption">${t("markdown.diagramFailed")}</span>`;
      block.dataset.rendered = "failed";
      block.classList.add("is-render-failed");
    }
  }
}
