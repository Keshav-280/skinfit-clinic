const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** Allow http:// EXPO_PUBLIC_API_URL on Android release (Chrome may work without this). */
function withAndroidHttpApi(config) {
  const apiBase = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
  let host = "";
  try {
    if (new URL(apiBase).protocol === "http:") {
      host = new URL(apiBase).hostname;
    }
  } catch {
    /* ignore */
  }
  if (!host) return config;

  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app) return config;
    app.$["android:usesCleartextTraffic"] = "true";
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">${host}</domain>
  </domain-config>
</network-security-config>
`;
      fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), xml);
      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidHttpApi;
