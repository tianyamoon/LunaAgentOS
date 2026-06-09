export function isAuthoritativeMemorySession(session, {
  hasPersistedHistory = false,
  isSessionActive,
} = {}) {
  if (!session) return false;
  if (!hasPersistedHistory) return true;
  if (session.inWorkspace !== false) return true;

  // 未提供活跃状态来源时保持旧行为，避免调用方静默降级为磁盘快照。
  return typeof isSessionActive !== "function" || isSessionActive(session.id);
}
