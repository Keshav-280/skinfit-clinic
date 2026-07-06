/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");
const fs = require("fs");
const path = require("path");
const { loadMobileDotEnv, readApiBaseFromEnvFile, apiUsesHttp } = require("./lib/loadMobileEnv");

loadMobileDotEnv();

function googleIosUrlScheme() {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  if (!iosClientId.endsWith(".apps.googleusercontent.com")) return null;
  const idPart = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${idPart}`;
}

/** iOS blocks http:// in the app (Safari may still work). IP exceptions are unreliable — allow cleartext when API is http. */
function iosAppTransportSecurity(apiBase) {
  const base = appJson.expo?.ios?.infoPlist?.NSAppTransportSecurity ?? {};
  const merged = { ...base, NSAllowsLocalNetworking: true };
  const raw = apiBase?.trim();
  if (!raw) return merged;
  try {
    if (new URL(raw).protocol === "http:") {
      return { ...merged, NSAllowsArbitraryLoads: true };
    }
  } catch {
    if (raw.toLowerCase().startsWith("http://")) {
      return { ...merged, NSAllowsArbitraryLoads: true };
    }
  }
  return merged;
}

module.exports = () => {
  const expo = { ...appJson.expo };
  const apiBase = readApiBaseFromEnvFile() || process.env.EXPO_PUBLIC_API_URL?.trim() || "";
  const iosUrlScheme = googleIosUrlScheme();
  /** Paid Apple Developer Program ($99/yr) required for native Sign in with Apple on device. */
  const nativeAppleSignIn =
    process.env.EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGNIN === "1";
  const iosPersonalTeam = process.env.EXPO_PUBLIC_IOS_PERSONAL_TEAM === "1";

  expo.ios = {
    ...expo.ios,
    usesAppleSignIn: nativeAppleSignIn,
    infoPlist: {
      ...expo.ios?.infoPlist,
      NSAppTransportSecurity: iosAppTransportSecurity(apiBase),
    },
  };

  if (apiBase.trim().toLowerCase().startsWith("http://")) {
    expo.android = {
      ...expo.android,
      usesCleartextTraffic: true,
    };
  }

  expo.extra = {
    ...(expo.extra ?? {}),
    apiUrl: apiBase.replace(/\/$/, ""),
  };

  const googleServicesPath = path.join(__dirname, "google-services.json");
  const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (!fs.existsSync(googleServicesPath) && googleServicesFromEnv) {
    fs.writeFileSync(googleServicesPath, googleServicesFromEnv, "utf8");
  }
  if (fs.existsSync(googleServicesPath)) {
    expo.android = {
      ...expo.android,
      googleServicesFile: "./google-services.json",
    };
  }

  const pluginEntries = (expo.plugins ?? [])
    .filter((entry) => {
      const id = Array.isArray(entry) ? entry[0] : entry;
      if (id === "expo-apple-authentication" && !nativeAppleSignIn) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      if (Array.isArray(entry) && entry[0] === "expo-build-properties" && apiUsesHttp(apiBase)) {
        const base = entry[1] ?? {};
        return [
          "expo-build-properties",
          {
            ...base,
            ios: {
              ...(base.ios ?? {}),
              infoPlist: {
                NSAppTransportSecurity: iosAppTransportSecurity(apiBase),
              },
            },
            android: {
              ...(base.android ?? {}),
              usesCleartextTraffic: true,
            },
          },
        ];
      }
      if (entry === "expo-build-properties" && apiUsesHttp(apiBase)) {
        return [
          "expo-build-properties",
          {
            ios: {
              infoPlist: {
                NSAppTransportSecurity: iosAppTransportSecurity(apiBase),
              },
            },
            android: {
              usesCleartextTraffic: true,
            },
          },
        ];
      }
      if (entry === "@react-native-google-signin/google-signin" && iosUrlScheme) {
        return [
          "@react-native-google-signin/google-signin",
          { iosUrlScheme },
        ];
      }
      return entry;
    });

  expo.plugins = [
    "./plugins/withAllowHttpApi",
    "./plugins/withAndroidHttpApi",
    ...pluginEntries,
    "./plugins/withGoogleSignInIosUrlScheme",
    ...(iosPersonalTeam ? ["./plugins/withPersonalTeamIos"] : []),
  ];

  return expo;
};
