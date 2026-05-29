const { withInfoPlist } = require("expo/config-plugins");

/**
 * React Native fetch() is blocked for http:// public hosts unless ATS allows it.
 * Safari can still load the same URL — rebuild iOS after changing EXPO_PUBLIC_API_URL.
 */
function withAllowHttpApi(config) {
  const apiBase = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
  let useHttp = false;
  try {
    useHttp = new URL(apiBase).protocol === "http:";
  } catch {
    useHttp = apiBase.toLowerCase().startsWith("http://");
  }
  if (!useHttp) return config;

  return withInfoPlist(config, (config) => {
    config.modResults.NSAppTransportSecurity = {
      ...(config.modResults.NSAppTransportSecurity ?? {}),
      NSAllowsLocalNetworking: true,
      NSAllowsArbitraryLoads: true,
    };
    return config;
  });
}

module.exports = withAllowHttpApi;
