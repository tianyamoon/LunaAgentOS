import test from "node:test";
import assert from "node:assert/strict";
import { createComposerController } from "./composerController.js";

// 构造足够支撑 Composer 行为测试的轻量 DOM 元素。
function makeElement() {
  const listeners = {};
  const classes = new Set();
  const attributes = new Map();
  return {
    listeners,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
      contains(name) { return classes.has(name); },
    },
    attributes,
    style: {},
    value: "",
    scrollHeight: 120,
    hidden: false,
    innerHTML: "",
    addEventListener(type, listener) { listeners[type] = listener; },
    appendChild() {},
    prepend() {},
    insertBefore() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getAttribute(name) { return attributes.get(name); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    setSelectionRange() {},
    focus() {},
    click() {},
    contains() { return false; },
  };
}

// 创建可观察附件与发送行为的 Composer Controller。
function makeHarness(overrides = {}) {
  const promptBox = makeElement();
  const composer = makeElement();
  const composerInputShell = makeElement();
  const composerAttachmentTray = makeElement();
  const composerFileInput = makeElement();
  composerFileInput.files = [];
  const attachBtn = makeElement();
  const promptStats = makeElement();
  const newSessionToggle = makeElement();
  const sendBtn = makeElement();
  const sendModeBtn = makeElement();
  const documentRoot = makeElement();
  documentRoot.createElement = makeElement;
  const storageValues = new Map();
  const sent = [];
  const notices = [];
  class FileReaderStub {
    addEventListener(type, listener) {
      this[type] = listener;
    }

    readAsText(file) {
      this.result = file.content;
      this.load();
    }
  }
  const controller = createComposerController({
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
    getCurrentTargetProvider: () => ({ id: "demo", adapterManifest: { capabilities: { slashCommands: [] } } }),
    getSlashCommandsForProvider: () => [],
    mergeSlashCommands: (items) => items,
    getUsageAgentKey: () => "agent-1",
    isComposingNewSession: () => false,
    currentComposerTargetLabel: () => "Demo",
    getSendAsNewSession: () => false,
    startSessionFromPrompt: (forceNew) => sent.push(forceNew),
    toggleNewSession: () => {},
    exitFullscreenSessions: () => false,
    setAppNotice: (message, tone) => notices.push({ message, tone }),
    t: (key, values = {}) => key === "composer.attachment.count"
      ? `${values.count}/${values.max}`
      : key,
    escapeHtml: (value) => String(value),
    storage: {
      getItem: (key) => storageValues.get(key) || null,
      setItem: (key, value) => storageValues.set(key, value),
    },
    documentRoot,
    windowRoot: { innerHeight: 1000 },
    FileReaderClass: FileReaderStub,
    now: () => 100,
    ...overrides,
  });
  return {
    controller,
    attachBtn,
    notices,
    promptBox,
    sendBtn,
    sendModeBtn,
    sent,
    newSessionToggle,
  };
}

test("composerController: 文本附件读取后可被清空", async () => {
  const { controller } = makeHarness();
  await controller.addFiles([{ name: "notes.md", type: "text/markdown", size: 5, content: "hello" }]);

  assert.equal(controller.getAttachments().length, 1);
  assert.equal(controller.getAttachments()[0].content, "hello");
  controller.clearAttachments();
  assert.deepEqual(controller.getAttachments(), []);
});

test("composerController: Enter 与 Ctrl+Enter 发送模式可切换", () => {
  const { controller, promptBox, sendModeBtn, sent } = makeHarness();
  controller.bindEvents();
  promptBox.listeners.keydown({ key: "Enter", isComposing: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault() {} });
  assert.deepEqual(sent, [false]);

  sendModeBtn.listeners.click();
  promptBox.listeners.keydown({ key: "Enter", isComposing: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault() {} });
  assert.deepEqual(sent, [false]);
  promptBox.listeners.keydown({ key: "Enter", isComposing: false, ctrlKey: true, shiftKey: false, altKey: false, preventDefault() {} });
  assert.deepEqual(sent, [false, false]);
});

test("composerController: 多次追加附件并独立删除任意一个", async () => {
  const { controller, attachBtn } = makeHarness();
  await controller.addFiles([
    { name: "a.md", type: "text/markdown", size: 1, content: "a" },
    { name: "b.md", type: "text/markdown", size: 1, content: "b" },
  ]);
  await controller.addFiles([
    { name: "c.md", type: "text/markdown", size: 1, content: "c" },
  ]);

  assert.deepEqual(controller.getAttachments().map((item) => item.name), ["a.md", "b.md", "c.md"]);
  assert.match(attachBtn.innerHTML, /3\/6/);

  controller.removeAttachment(controller.getAttachments()[1].id);
  assert.deepEqual(controller.getAttachments().map((item) => item.name), ["a.md", "c.md"]);
  assert.match(attachBtn.innerHTML, /2\/6/);
});

test("composerController: 超出六个附件时保留上限并显示提示", async () => {
  const { controller, notices } = makeHarness();
  const files = Array.from({ length: 7 }, (_, index) => ({
    name: `${index}.md`,
    type: "text/markdown",
    size: 1,
    content: String(index),
  }));

  await controller.addFiles(files);

  assert.equal(controller.getAttachments().length, 6);
  assert.equal(notices.at(-1).tone, "error");
});

test("composerController: 只读历史的隐式新会话状态不会伪装成已选择另开会话", () => {
  const { controller, newSessionToggle, sendBtn, sent } = makeHarness({
    isComposingNewSession: () => true,
    getSendAsNewSession: () => false,
  });

  controller.updateActionLabels();
  controller.bindEvents();
  sendBtn.listeners.click();

  assert.equal(newSessionToggle.classList.contains("is-active"), false);
  assert.equal(newSessionToggle.getAttribute("aria-pressed"), "false");
  assert.deepEqual(sent, [false]);
});
