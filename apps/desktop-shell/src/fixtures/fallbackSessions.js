// Fallback 数据只用于未接入 Runtime Surface 的演示入口。
// 具体产品示例隔离在 fixture 中，Shell 主流程只按 providerId 查表。
export const FALLBACK_SESSIONS = {
  hermes: {
    events: [
      { type: "state", state: 0, contentKey: "fallback.hermes.stateStart" },
      { type: "thought", state: 2, contentKey: "fallback.hermes.thought" },
      { type: "response", state: 4, contentKey: "fallback.hermes.response" },
      { type: "state", state: 5, contentKey: "fallback.hermes.stateDone" },
    ],
  },
};
