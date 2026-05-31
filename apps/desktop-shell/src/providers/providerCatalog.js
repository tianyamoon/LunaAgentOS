// Provider Catalog 模块。
// 统一解释 Adapter manifest 暴露的运行身份能力，避免 Shell 按 Provider 名称写分支。

// identityOnly Provider 只注册桌面入口身份，不承诺由通用 ACP Host 启动。
export function isIdentityOnlyProvider(provider) {
  return provider?.identityOnly === true || provider?.adapterManifest?.identityOnly === true;
}

// 通用启动路径只接受声明了可运行身份的 Provider。
export function providerSupportsLaunch(provider) {
  return Boolean(provider) && !isIdentityOnlyProvider(provider);
}
