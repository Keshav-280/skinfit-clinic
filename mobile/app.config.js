/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

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
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "";
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

  const pluginEntries = (expo.plugins ?? [])
    .filter((entry) => {
      const id = Array.isArray(entry) ? entry[0] : entry;
      if (id === "expo-apple-authentication" && !nativeAppleSignIn) {
        return false;
      }
      return true;
    })
    .map((entry) => {
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
    ...pluginEntries,
    "./plugins/withGoogleSignInIosUrlScheme",
    ...(iosPersonalTeam ? ["./plugins/withPersonalTeamIos"] : []),
  ];

  return expo;
};
