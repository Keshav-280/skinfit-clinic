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
      // #region agent log
      fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'PushTokenSync.tsx:effect',message:'PushTokenSync run',data:{ready,hasToken:Boolean(token),permissionStatus:status,willRequest:status==='undetermined'},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      void registerForPushAndSyncToken(token, {
        verboseAlerts: false,
        requestPermission: status === "undetermined",
      });
    })();
  }, [ready, token]);

  return null;
}
