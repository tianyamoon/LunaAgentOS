import test from "node:test";
import assert from "node:assert/strict";
import { createComposerController } from "./composerController.js";

// 构造足够支撑 Composer 行为测试的轻量 DOM 元素。
function makeElement() {
  const listeners = {};
  return {
    listeners,
    classList: { add() {}, remove() {}, toggle() {} },
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
    setAttribute() {},
    setSelectionRange() {},
    focus() {},
    click() {},
    contains() { return false; },
  };
}

// 创建可观察附件与发送行为的 Composer Controller。
function makeHarness() {
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
    setAppNotice: () => {},
    t: (key) => key,
    escapeHtml: (value) => String(value),
    storage: {
      getItem: (key) => storageValues.get(key) || null,
      setItem: (key, value) => storageValues.set(key, value),
    },
    documentRoot,
    windowRoot: { innerHeight: 1000 },
    FileReaderClass: FileReaderStub,
    now: () => 100,
  });
  return {
    controller,
    promptBox,
    sendModeBtn,
    sent,
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
