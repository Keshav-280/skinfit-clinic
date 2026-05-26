const { withInfoPlist, IOSConfig } = require("@expo/config-plugins");

function googleIosUrlSchemeFromEnv() {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  if (!iosClientId.endsWith(".apps.googleusercontent.com")) return null;
  const idPart = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${idPart}`;
}

/**
 * Google Sign-In on iOS requires the reversed iOS OAuth client id as a URL scheme.
 * @see https://react-native-google-signin.github.io/docs/setting-up/ios
 */
function withGoogleSignInIosUrlScheme(config) {
  const scheme = googleIosUrlSchemeFromEnv();
  if (!scheme) return config;

  return withInfoPlist(config, (config) => {
    if (!IOSConfig.Scheme.hasScheme(scheme, config.modResults)) {
      config.modResults = IOSConfig.Scheme.appendScheme(scheme, config.modResults);
    }
    return config;
  });
}

module.exports = withGoogleSignInIosUrlScheme;
