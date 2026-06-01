// Composer Controller 模块。
// 集中管理输入框可读性、附件、斜杠菜单、发送键模式和 Composer DOM 事件。
import {
  DEFAULT_ATTACHMENT_LIMITS,
  attachmentStatus,
  composerStats,
  formatAttachmentBytes,
  isLikelyTextAttachment,
} from "./composerAttachments.js";
import {
  filterComposerSlashCommands,
  matchComposerSlashQuery,
  normalizeSlashCommand,
} from "./slashCommands.js";

// 保留旧版持久化值，避免升级后用户的发送模式被无意重置。
const SEND_MODE_OPTIONS = ["enter", "ctrlEnter"];

// 创建 Composer 控制器。领域状态通过回调注入，模块自身只维护输入交互状态。
export function createComposerController({
  promptBox,
  composer,
  composerInputShell,
  composerAttachmentTray,
  composerFileInput,
  attachBtn,
  promptStats,
  newSessionToggle,
  sendBtn,
  sendModeBtn,
  getCurrentTargetProvider,
  getSlashCommandsForProvider,
  mergeSlashCommands,
  getUsageAgentKey,
  isComposingNewSession,
  currentComposerTargetLabel,
  getSendAsNewSession,
  startSessionFromPrompt,
  toggleNewSession,
  exitFullscreenSessions,
  setAppNotice,
  t,
  escapeHtml,
  storage = localStorage,
  documentRoot = document,
  windowRoot = window,
  FileReaderClass = FileReader,
  sendModeKey = "lunaagentos.sendMode",
  slashUsageKey = "lunaagentos.slashCommandUsage",
  now = () => Date.now(),
}) {
  let sendMode = storage.getItem(sendModeKey) || "enter";
  let commandHint = null;
  let commandMenu = null;
  let commandMenuOpen = false;
  let commandMenuPinned = false;
  let commandMenuActiveIndex = 0;
  let commandSearchQuery = "";
  let commandSearchFocused = false;
  let attachmentSeq = 0;
  let attachments = [];
  let slashUsage = readSlashUsage();

  // 容错读取按 Agent 记录的斜杠命令使用频率。
  function readSlashUsage() {
    try {
      const stored = JSON.parse(storage.getItem(slashUsageKey) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    } catch {
      return {};
    }
  }

  // 返回当前 Agent 的命令使用频率。
  function usageForCurrentAgent() {
    const usage = slashUsage[getUsageAgentKey()];
    return usage && typeof usage === "object" && !Array.isArray(usage) ? usage : {};
  }

  // 记录命令使用次数，为常用命令排序提供依据。
  function recordSlashUsage(commandName) {
    const agentKey = getUsageAgentKey();
    const current = usageForCurrentAgent();
    slashUsage = {
      ...slashUsage,
      [agentKey]: {
        ...current,
        [commandName]: Number(current[commandName] || 0) + 1,
      },
    };
    storage.setItem(slashUsageKey, JSON.stringify(slashUsage));
  }

  // 调整输入框高度，在可读性和工作区空间之间保持平衡。
  function autoResizePromptBox() {
    if (!promptBox) return;
    promptBox.style.height = "auto";
    const nextHeight = Math.min(Math.max(promptBox.scrollHeight, 92), Math.floor(windowRoot.innerHeight * 0.32));
    promptBox.style.height = `${nextHeight}px`;
  }

  // 刷新输入字符数和行数。
  function updatePromptStats() {
    if (!promptStats) return;
    const stats = composerStats(promptBox.value);
    promptStats.textContent = t("composer.stats", { chars: stats.chars, lines: stats.lines });
  }

  // 返回附件面向用户的状态文案。
  function attachmentStatusLabel(attachment) {
    const status = attachmentStatus(attachment);
    if (status === "ready") return t("composer.attachment.ready");
    if (status === "error") return attachment.error || t("composer.attachment.unsupported");
    return t("composer.attachment.metadataOnly");
  }

  // 回形针入口显示当前数量，让多附件能力在输入框内部保持可见。
  function renderAttachButton() {
    if (!attachBtn) return;
    const countLabel = t("composer.attachment.count", {
      count: attachments.length,
      max: DEFAULT_ATTACHMENT_LIMITS.maxFiles,
    });
    const ariaLabel = t("composer.attachAria", {
      count: attachments.length,
      max: DEFAULT_ATTACHMENT_LIMITS.maxFiles,
    });
    attachBtn.title = `${t("composer.attachTitle")} · ${countLabel}`;
    attachBtn.setAttribute("aria-label", ariaLabel);
    attachBtn.innerHTML = `
      <svg class="composer-attach-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>
      <span class="composer-attach-count">${escapeHtml(countLabel)}</span>
    `;
  }

  // 单个删除是显式命令，便于托盘按钮和测试共享同一路径。
  function removeAttachment(attachmentId) {
    attachments = attachments.filter((item) => item.id !== attachmentId);
    renderAttachments();
    promptBox.focus();
  }

  // 渲染附件托盘，并为每个附件绑定删除动作。
  function renderAttachments() {
    if (!composerAttachmentTray) return;
    renderAttachButton();
    composerAttachmentTray.hidden = attachments.length === 0;
    if (!attachments.length) {
      composerAttachmentTray.innerHTML = "";
      return;
    }
    composerAttachmentTray.innerHTML = attachments.map((attachment) => {
      const status = attachmentStatus(attachment);
      const statusClass = status === "ready" ? "is-ready" : status === "error" ? "is-error" : "is-muted";
      const size = attachment.sizeLabel || formatAttachmentBytes(attachment.size);
      const removeLabel = t("composer.attachment.remove", { name: attachment.name });
      return `
        <span class="composer-attachment-chip ${statusClass}" title="${escapeHtml(attachmentStatusLabel(attachment))}">
          <span class="composer-attachment-name">${escapeHtml(attachment.name)}</span>
          <span class="composer-attachment-meta">${escapeHtml(size)}</span>
          <span class="composer-attachment-state">${escapeHtml(attachmentStatusLabel(attachment))}</span>
          <button type="button" class="composer-attachment-remove" data-attachment-id="${escapeHtml(attachment.id)}" title="${escapeHtml(removeLabel)}" aria-label="${escapeHtml(removeLabel)}">&times;</button>
        </span>
      `;
    }).join("");
    composerAttachmentTray.querySelectorAll(".composer-attachment-remove").forEach((button) => {
      button.addEventListener("click", () => {
        removeAttachment(button.dataset.attachmentId);
      });
    });
  }

  // 清空已选附件，通常在发送成功创建 Turn 后调用。
  function clearAttachments() {
    attachments = [];
    renderAttachments();
  }

  // 读取文本附件；二进制文件保留为带解释的元数据项。
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReaderClass();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("read failed")));
      reader.readAsText(file);
    });
  }

  // 添加附件并执行数量、文本类型和长度限制。
  async function addFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const availableSlots = DEFAULT_ATTACHMENT_LIMITS.maxFiles - attachments.length;
    const accepted = files.slice(0, Math.max(0, availableSlots));
    if (files.length > accepted.length) {
      setAppNotice(t("composer.attachment.limit", { count: DEFAULT_ATTACHMENT_LIMITS.maxFiles }), "error");
    }
    for (const file of accepted) {
      const id = `attachment-${now()}-${++attachmentSeq}`;
      const base = {
        id,
        name: file.name,
        type: file.type || "",
        size: file.size,
        sizeLabel: formatAttachmentBytes(file.size),
        content: "",
      };
      if (!isLikelyTextAttachment(file)) {
        attachments.push({ ...base, error: t("composer.attachment.unsupported") });
        continue;
      }
      try {
        const raw = await readFileAsText(file);
        const truncated = raw.length > DEFAULT_ATTACHMENT_LIMITS.maxCharsPerFile;
        attachments.push({
          ...base,
          content: truncated ? raw.slice(0, DEFAULT_ATTACHMENT_LIMITS.maxCharsPerFile) : raw,
          truncated,
        });
      } catch {
        attachments.push({ ...base, error: t("composer.attachment.readFailed") });
      }
    }
    renderAttachments();
    promptBox.focus();
  }

  // 创建斜杠命令提示栏。
  function ensureCommandHint() {
    if (!composer || commandHint) return;
    const row = composer.querySelector(".composer-row");
    commandHint = documentRoot.createElement("div");
    commandHint.className = "composer-command-hint";
    commandHint.setAttribute("aria-live", "polite");
    if (row) composer.insertBefore(commandHint, row);
    else composer.prepend(commandHint);
  }

  // 创建斜杠命令弹层。
  function ensureCommandMenu() {
    if (!composer || commandMenu) return;
    commandMenu = documentRoot.createElement("div");
    commandMenu.className = "composer-command-menu";
    commandMenu.hidden = true;
    composer.appendChild(commandMenu);
  }

  // 合并 manifest 与 runtime 动态命令，并补齐本地化文案。
  function localizedSlashCommands() {
    const provider = getCurrentTargetProvider();
    const providerId = provider?.id;
    const manifestCommands = provider?.adapterManifest?.capabilities?.slashCommands;
    const dynamicCommands = providerId ? getSlashCommandsForProvider(providerId) : [];
    return mergeSlashCommands([
      ...(Array.isArray(manifestCommands) ? manifestCommands : []),
      ...(Array.isArray(dynamicCommands) ? dynamicCommands : []),
    ])
      .map((command) => normalizeSlashCommand(command, {
        providerId,
        description: command.description || t(command.descriptionKey),
      }))
      .filter(Boolean);
  }

  // 根据输入、搜索框和常用频率筛选命令。
  function filteredSlashCommands() {
    const searchQuery = commandSearchFocused || commandSearchQuery
      ? commandSearchQuery.trim().toLowerCase()
      : null;
    return filterComposerSlashCommands(localizedSlashCommands(), {
      providerId: getCurrentTargetProvider()?.id,
      query: searchQuery ?? matchComposerSlashQuery(promptBox.value),
      pinned: searchQuery === null && commandMenuPinned,
      usageByName: usageForCurrentAgent(),
    });
  }

  // 关闭斜杠命令弹层并复位临时状态。
  function closeCommandMenu() {
    commandMenuOpen = false;
    commandMenuPinned = false;
    commandSearchFocused = false;
    commandMenuActiveIndex = 0;
    if (commandMenu) commandMenu.hidden = true;
  }

  // 打开斜杠命令弹层。
  function openCommandMenu({ pinned = false } = {}) {
    ensureCommandMenu();
    commandMenuOpen = true;
    commandMenuPinned = pinned;
    commandMenuActiveIndex = 0;
    renderCommandMenu();
  }

  // 选择命令并写回输入框。
  function selectCommand(index) {
    const command = filteredSlashCommands()[index];
    if (!command) return false;
    promptBox.value = `/${command.name} `;
    recordSlashUsage(command.name);
    commandSearchQuery = "";
    commandSearchFocused = false;
    promptBox.focus();
    promptBox.setSelectionRange(promptBox.value.length, promptBox.value.length);
    closeCommandMenu();
    updateCommandHint();
    return true;
  }

  // 同步键盘选中的命令行。
  function syncCommandMenuActiveItem({ scrollIntoView = false } = {}) {
    if (!commandMenu) return;
    commandMenu.querySelectorAll(".composer-command-menu-item").forEach((button) => {
      const isActive = Number(button.dataset.commandIndex || 0) === commandMenuActiveIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive && scrollIntoView) button.scrollIntoView({ block: "nearest" });
    });
  }

  // 渲染斜杠命令弹层。
  function renderCommandMenu() {
    ensureCommandMenu();
    if (!commandMenu) return;
    const commands = filteredSlashCommands();
    const usageByName = usageForCurrentAgent();
    if (!commandMenuOpen) {
      commandMenu.hidden = true;
      return;
    }
    if (commandMenuActiveIndex >= commands.length) commandMenuActiveIndex = 0;
    commandMenu.hidden = false;
    commandMenu.innerHTML = `
      <div class="composer-command-menu-panel" role="listbox" aria-label="${escapeHtml(t("composer.commandMenu.title"))}">
        <div class="composer-command-menu-header">
          <strong>${escapeHtml(t("composer.commandMenu.title"))}</strong>
          <span>${escapeHtml(t("composer.commandMenu.hint"))}</span>
        </div>
        <div class="composer-command-menu-list">
          ${commands.length ? commands.map((command, index) => `
            <button type="button" class="composer-command-menu-item ${index === commandMenuActiveIndex ? "is-active" : ""}" role="option" aria-selected="${index === commandMenuActiveIndex ? "true" : "false"}" data-command-index="${index}">
              <span class="composer-command-menu-name">/${escapeHtml(command.name)}</span>
              <span class="composer-command-menu-description">${escapeHtml(command.description || t(command.descriptionKey))}</span>
              ${usageByName[command.name] ? `<span class="composer-command-menu-badge">${escapeHtml(t("composer.commandMenu.frequent"))}</span>` : ""}
            </button>
          `).join("") : `<div class="composer-command-menu-empty">${escapeHtml(t("composer.commandMenu.empty"))}</div>`}
        </div>
      </div>
    `;
    commandMenu.querySelectorAll(".composer-command-menu-item").forEach((button) => {
      button.addEventListener("mouseenter", () => {
        commandMenuActiveIndex = Number(button.dataset.commandIndex || 0);
        syncCommandMenuActiveItem();
      });
      button.addEventListener("click", () => {
        selectCommand(Number(button.dataset.commandIndex || 0));
      });
    });
  }

  // 刷新提示栏，并根据输入内容决定是否自动打开命令弹层。
  function updateCommandHint() {
    ensureCommandHint();
    if (!commandHint) return;
    const slashQuery = matchComposerSlashQuery(promptBox.value);
    const isSlash = promptBox.value.trimStart().startsWith("/");
    composer?.classList.toggle("is-slash-input", isSlash);
    commandHint.innerHTML = `
      <button type="button" class="composer-command-chip composer-command-open-btn ${isSlash ? "is-active" : ""}" aria-haspopup="listbox" aria-expanded="${commandMenuOpen ? "true" : "false"}">${escapeHtml(t("composer.input.slash"))}</button>
      <input class="composer-command-search" type="search" value="${escapeHtml(commandSearchQuery)}" placeholder="${escapeHtml(t("composer.commandMenu.searchPlaceholder"))}" aria-label="${escapeHtml(t("composer.commandMenu.searchLabel"))}">
    `;
    const searchInput = commandHint.querySelector(".composer-command-search");
    const openSearchMenu = () => {
      commandSearchFocused = true;
      openCommandMenu();
    };
    commandHint.querySelector(".composer-command-open-btn")?.addEventListener("click", () => {
      openSearchMenu();
      searchInput?.focus();
    });
    searchInput?.addEventListener("focus", openSearchMenu);
    searchInput?.addEventListener("input", () => {
      commandSearchFocused = true;
      commandSearchQuery = searchInput.value;
      openCommandMenu();
    });
    searchInput?.addEventListener("keydown", handleCommandMenuKeydown);
    if (slashQuery !== null) {
      commandMenuPinned = false;
      commandMenuOpen = true;
      renderCommandMenu();
    } else if (!commandMenuPinned && !commandSearchFocused) {
      closeCommandMenu();
    }
  }

  // 处理命令弹层内的方向键、确认键和退出键。
  function handleCommandMenuKeydown(event) {
    if (!commandMenuOpen) return false;
    const commands = filteredSlashCommands();
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandMenu();
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      commandMenuActiveIndex = commands.length
        ? (commandMenuActiveIndex + delta + commands.length) % commands.length
        : 0;
      syncCommandMenuActiveItem({ scrollIntoView: true });
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      return selectCommand(commandMenuActiveIndex);
    }
    return false;
  }

  // 刷新输入框 placeholder。
  function updatePromptPlaceholder() {
    const target = currentComposerTargetLabel();
    promptBox.placeholder = target
      ? t(isComposingNewSession() ? "composer.placeholderNewSession" : "composer.placeholderCurrentSession", { target })
      : t("composer.placeholderNoTarget");
  }

  // 刷新输入区域可读性，包括高度、统计和附件托盘。
  function updateReadability() {
    autoResizePromptBox();
    updatePromptStats();
    renderAttachments();
  }

  // 刷新发送模式按钮。
  function updateSendModeLabel() {
    if (!sendModeBtn) return;
    sendModeBtn.textContent = sendMode === "enter" ? t("composer.enterSend") : t("composer.ctrlEnter");
  }

  // 切换 Enter 与 Ctrl+Enter 发送模式。
  function toggleSendMode() {
    const index = SEND_MODE_OPTIONS.indexOf(sendMode);
    sendMode = SEND_MODE_OPTIONS[(index + 1) % SEND_MODE_OPTIONS.length];
    storage.setItem(sendModeKey, sendMode);
    updateSendModeLabel();
  }

  // 刷新 Composer 顶层状态标签。
  function updateActionLabels() {
    const composingNewSession = isComposingNewSession();
    sendBtn.textContent = t("composer.send");
    if (attachBtn) {
      renderAttachButton();
    }
    newSessionToggle.classList.toggle("is-active", composingNewSession);
    newSessionToggle.setAttribute("aria-pressed", String(composingNewSession));
    composer?.classList.toggle("is-new-session-mode", composingNewSession);
    composer?.classList.toggle("is-current-session-mode", !composingNewSession);
    updateCommandHint();
    updatePromptPlaceholder();
    updateReadability();
  }

  // Provider 动态命令变化后刷新提示栏与已打开的菜单。
  function refreshCommands() {
    updateCommandHint();
    if (commandMenuOpen) renderCommandMenu();
  }

  // 绑定 Composer 所有 DOM 事件，仅在应用启动时调用一次。
  function bindEvents() {
    sendBtn.addEventListener("click", () => startSessionFromPrompt(getSendAsNewSession()));
    sendModeBtn?.addEventListener("click", toggleSendMode);
    attachBtn?.addEventListener("click", () => composerFileInput?.click());
    composerFileInput?.addEventListener("change", () => {
      void addFiles(composerFileInput.files);
      composerFileInput.value = "";
    });
    composerInputShell?.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      composerInputShell.classList.add("is-drag-over");
    });
    composerInputShell?.addEventListener("dragleave", () => {
      composerInputShell.classList.remove("is-drag-over");
    });
    composerInputShell?.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      composerInputShell.classList.remove("is-drag-over");
      void addFiles(event.dataTransfer.files);
    });
    promptBox.addEventListener("keydown", (event) => {
      if (handleCommandMenuKeydown(event)) return;
      if (event.key !== "Enter" || event.isComposing) return;
      const shouldSend = sendMode === "enter"
        ? !event.ctrlKey && !event.shiftKey && !event.altKey
        : event.ctrlKey && !event.shiftKey && !event.altKey;
      if (!shouldSend) return;
      event.preventDefault();
      startSessionFromPrompt(getSendAsNewSession());
    });
    promptBox.addEventListener("input", () => {
      commandSearchFocused = false;
      updateCommandHint();
      updateReadability();
    });
    documentRoot.addEventListener("pointerdown", (event) => {
      if (!commandMenuOpen || composer?.contains(event.target)) return;
      closeCommandMenu();
    });
    documentRoot.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (commandMenuOpen) {
        closeCommandMenu();
        event.preventDefault();
        return;
      }
      if (exitFullscreenSessions()) event.preventDefault();
    });
    newSessionToggle.addEventListener("click", toggleNewSession);
  }

  return {
    addFiles,
    bindEvents,
    clearAttachments,
    getAttachments: () => attachments,
    removeAttachment,
    refreshCommands,
    updateActionLabels,
    updatePromptPlaceholder,
    updateReadability,
    updateSendModeLabel,
  };
}
