export function applyWebUnavailableGate({ document, isWebPreview } = {}) {
  if (!document || !isWebPreview) return false;
  const gate = document.getElementById("webUnavailableGate");
  const appShell = document.querySelector(".app-shell");
  if (!gate) return false;
  gate.hidden = false;
  document.body?.classList?.add("is-web-unavailable");
  if (appShell) {
    appShell.inert = true;
    appShell.setAttribute?.("aria-hidden", "true");
  }
  return true;
}
