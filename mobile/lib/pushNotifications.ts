import Constants from "expo-constants";
import { Alert, Platform } from "react-native";

import { apiJson } from "@/lib/api";

export type RegisterPushOptions = {
  /**
   * Show Alert dialogs (simulator, denied permission, errors, etc.).
   * Use false for background sync after login / app resume.
   * @default true
   */
  verboseAlerts?: boolean;
  /**
   * If false, only sync when permission is already granted (no OS prompt).
   * @default true
   */
  requestPermission?: boolean;
};

/**
 * Requests OS permission (optional), obtains Expo push token, POSTs to `/api/user/push-token`.
 * Returns token string or null. Physical device required (native only).
 */
export async function registerForPushAndSyncToken(
  bearerToken: string,
  options: RegisterPushOptions = {}
): Promise<string | null> {
  const verboseAlerts = options.verboseAlerts !== false;
  const requestPermission = options.requestPermission !== false;

  // #region agent log
  fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:start',message:'registerForPush start',data:{platform:Platform.OS,verboseAlerts,requestPermission,hasBearer:Boolean(bearerToken)},timestamp:Date.now(),hypothesisId:'A,E'})}).catch(()=>{});
  // #endregion

  if (Platform.OS === "web") {
    return null;
  }

  const Notifications = await import("expo-notifications");
  const Device = await import("expo-device");

  if (!Device.isDevice) {
    // #region agent log
    fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:simulator',message:'not a physical device',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (verboseAlerts) {
      Alert.alert(
        "Simulator",
        "Push notifications need a physical phone. The in-app bell still shows unread clinic messages."
      );
    }
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "SkinFit",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0d9488",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted" && requestPermission) {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  // #region agent log
  fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:permission',message:'permission result',data:{existing,final,requestPermission},timestamp:Date.now(),hypothesisId:'A,E'})}).catch(()=>{});
  // #endregion
  if (final !== "granted") {
    if (verboseAlerts && requestPermission) {
      Alert.alert(
        "Notifications disabled",
        "Turn on notifications in system Settings to get alerts when the clinic messages you."
      );
    }
    return null;
  }

  try {
    const extra = Constants.expoConfig?.extra;
    const eas =
      extra && typeof extra === "object" && "eas" in extra && extra.eas && typeof extra.eas === "object"
        ? (extra.eas as { projectId?: string })
        : undefined;
    const projectId = eas?.projectId ? String(eas.projectId) : undefined;

    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const expoPushToken = tokenRes.data;
    // #region agent log
    fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:token',message:'got expo push token',data:{hasProjectId:Boolean(projectId),tokenPrefix:expoPushToken?.slice(0,28)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    await apiJson<{ success?: boolean }>("/api/user/push-token", bearerToken, {
      method: "POST",
      body: JSON.stringify({ expoPushToken }),
    });
    // #region agent log
    fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:synced',message:'token synced to server',data:{ok:true},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return expoPushToken;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // #region agent log
    fetch('http://127.0.0.1:7495/ingest/46405248-daa7-4e06-841d-ee5b0e58c44b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d1bdd'},body:JSON.stringify({sessionId:'0d1bdd',location:'pushNotifications.ts:register:error',message:'register failed',data:{errMsg},timestamp:Date.now(),hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
    if (__DEV__ && e instanceof Error) {
      console.warn("[push] register failed:", e.message);
    }
    if (verboseAlerts) {
      Alert.alert(
        "Notifications",
        "We couldn't turn on alerts for this device. Check notification permissions in system Settings, then sign in again."
      );
    }
    return null;
  }
}

export async function unregisterPushToken(bearerToken: string): Promise<void> {
  await apiJson("/api/user/push-token", bearerToken, {
    method: "POST",
    body: JSON.stringify({ expoPushToken: null }),
  });
}
