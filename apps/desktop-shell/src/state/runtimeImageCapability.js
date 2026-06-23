// Runtime Image Capability 模块。
// 缓存各 Provider 在 ACP initialize 时上报的 promptCapabilities.image，
// 供 Composer 在粘贴/拖入图片前做门控。数据来源是运行时事件，按 Provider 聚合。
//
// 设计取舍：能力以 ACP 动态声明为准（而非 manifest 静态声明），因为同一 adapter
// 的不同版本对图片支持可能不同；进程未起时无数据，按未知处理（默认不阻止，由后端兜底）。

export function createRuntimeImageCapabilityStore() {
  // providerId -> boolean（是否支持图片输入）
  const byProvider = new Map();

  // 从 ACP state:0 事件 payload 中提取 promptCapabilities.image。
  // 形如 { type:"state", state:0, payload:{ capabilities:{ promptCapabilities:{ image:true } } } }
  function recordFromEvent(providerId, event) {
    if (!providerId || event?.type !== "state" || event.state !== 0) return;
    const image = event?.payload?.capabilities?.promptCapabilities?.image;
    if (typeof image === "boolean") {
      byProvider.set(providerId, image);
    }
  }

  // 返回该 Provider 是否支持图片。尚无运行时数据时返回 undefined（未知）。
  function isImageCapable(providerId) {
    return byProvider.get(providerId);
  }

  function reset() {
    byProvider.clear();
  }

  return { recordFromEvent, isImageCapable, reset };
}
