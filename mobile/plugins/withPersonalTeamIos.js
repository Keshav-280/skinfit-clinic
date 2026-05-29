const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

/**
 * Free Apple "Personal Team" cannot provision Push Notifications or Sign in with Apple.
 * Set EXPO_PUBLIC_IOS_PERSONAL_TEAM=1 in mobile/.env, then prebuild --clean.
 *
 * Real iOS push (APNs / Expo token on device) needs the paid Apple Developer Program.
 */
function withPersonalTeamIos(config) {
  if (process.env.EXPO_PUBLIC_IOS_PERSONAL_TEAM !== "1") {
    return config;
  }

  config = withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    delete config.modResults["com.apple.developer.applesignin"];
    return config;
  });

  config = withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) {
      config.modResults.UIBackgroundModes = modes.filter(
        (m) => m !== "remote-notification"
      );
    }
    return config;
  });

  return config;
}

module.exports = withPersonalTeamIos;
