// History Repository Module。
// 统一管理 History 的后端 IO、内存快照与归档投影，让 Shell 不再持有可写条目数组。

import { historySessionKey } from "./entries.js";
import { formatCompactHistoryNotice, upsertHistoryEntry } from "./payload.js";

// 创建 History Repository。数据构造与归档投影由调用方注入，以保持 Repository 与运行时身份解耦。
export function createHistoryRepository({
  invoke,
  buildPayload,
  projectArchivedSessions,
}) {
  let entries = [];
  let loading = true;
  const listeners = new Set();

  // 通知订阅方快照已发生变化。
  function notify() {
    listeners.forEach((listener) => listener());
  }

  // 加载并压缩历史记录。失败时清空旧快照，避免界面展示过期数据。
  async function load() {
    loading = true;
    notify();
    try {
      const compactResult = await invoke("compact_history_entries");
      entries = await invoke("load_history_entries");
      return {
        entries: getEntriesSnapshot(),
        notice: formatCompactHistoryNotice(compactResult),
      };
    } catch (error) {
      // 加载失败时保留上一次可用快照，避免桌面端历史列表瞬间清空。
      throw error;
    } finally {
      loading = false;
      notify();
    }
  }

  // 追加一个 Turn，并把后端返回的规范化条目合并到内存快照。
  async function appendTurn({ session, turn }) {
    const entry = await invoke("append_history_entry", {
      entry: buildPayload({ session, turn }),
    });
    entries = upsertHistoryEntry(entries, entry);
    notify();
    return entry;
  }

  // 归档指定 Session 的磁盘条目，并重新加载后端快照。
  async function archiveSession(sessionId) {
    await invoke("archive_history_session_entries", { sessionId });
    entries = await invoke("load_history_entries");
    notify();
    return getEntriesSnapshot();
  }

  // 删除指定 Session 的磁盘条目；成功后同步移除内存中的对应条目。
  async function deleteSession(sessionId) {
    const result = await invoke("delete_history_session_entries", { sessionId });
    entries = entries.filter((entry) => historySessionKey(entry) !== sessionId);
    notify();
    return result;
  }

  // 返回隔离的 History 条目数组，调用方不能替换 Repository 内部列表。
  function getEntriesSnapshot() {
    return [...entries];
  }

  // 基于当前快照生成只读归档 Session。
  function getArchivedSessions() {
    return projectArchivedSessions(getEntriesSnapshot());
  }

  // 暴露加载状态，供 History View 展示骨架内容。
  function isLoading() {
    return loading;
  }

  // 注册快照变化监听器，并返回解除订阅函数。
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    load,
    appendTurn,
    archiveSession,
    deleteSession,
    getEntriesSnapshot,
    getArchivedSessions,
    isLoading,
    subscribe,
  };
}
