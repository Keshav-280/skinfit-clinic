/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

function googleIosUrlScheme() {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  if (!iosClientId.endsWith(".apps.googleusercontent.com")) return null;
  const idPart = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
  return `com.googleusercontent.apps.${idPart}`;
}

module.exports = () => {
  const expo = { ...appJson.expo };
  const iosUrlScheme = googleIosUrlScheme();
  /** Paid Apple Developer Program ($99/yr) required for native Sign in with Apple on device. */
  const nativeAppleSignIn =
    process.env.EXPO_PUBLIC_ENABLE_NATIVE_APPLE_SIGNIN === "1";

  expo.ios = {
    ...expo.ios,
    usesAppleSignIn: nativeAppleSignIn,
  };

  expo.plugins = [
    ...(expo.plugins ?? []).map((entry) => {
      if (entry === "@react-native-google-signin/google-signin" && iosUrlScheme) {
        return [
          "@react-native-google-signin/google-signin",
          { iosUrlScheme },
        ];
      }
      return entry;
    }),
    "./plugins/withGoogleSignInIosUrlScheme",
  ];

  return expo;
};
