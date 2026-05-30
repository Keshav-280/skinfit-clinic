const { withInfoPlist } = require("expo/config-plugins");
const { apiUsesHttp, readApiBaseFromEnvFile } = require("../lib/loadMobileEnv");

/**
 * React Native fetch() is blocked for http:// public hosts unless ATS allows it.
 * Safari can still load the same URL — rebuild iOS after changing EXPO_PUBLIC_API_URL.
 */
function withAllowHttpApi(config) {
  const apiBase = readApiBaseFromEnvFile();
  if (!apiUsesHttp(apiBase)) return config;

  let host = "";
  try {
    host = new URL(apiBase).hostname;
  } catch {
    /* ignore */
  }

  return withInfoPlist(config, (config) => {
    const ats = {
      ...(config.modResults.NSAppTransportSecurity ?? {}),
      NSAllowsLocalNetworking: true,
      NSAllowsArbitraryLoads: true,
    };
    if (host) {
      ats.NSExceptionDomains = {
        ...(ats.NSExceptionDomains ?? {}),
        [host]: {
          NSExceptionAllowsInsecureHTTPLoads: true,
          NSIncludesSubdomains: false,
        },
      };
    }
    config.modResults.NSAppTransportSecurity = ats;
    return config;
  });
}

module.exports = withAllowHttpApi;
