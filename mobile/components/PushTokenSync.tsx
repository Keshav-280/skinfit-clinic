import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { registerForPushAndSyncToken } from "@/lib/pushNotifications";

/**
 * When a saved session loads, sync the Expo push token if notifications are allowed.
 * If the OS has never been asked, request permission once (same as sign-in).
 */
export function PushTokenSync() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready || !token || Platform.OS === "web") return;
    void (async () => {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.getPermissionsAsync();
      void registerForPushAndSyncToken(token, {
        verboseAlerts: false,
        requestPermission: status === "undetermined",
      });
    })();
  }, [ready, token]);

  return null;
}
