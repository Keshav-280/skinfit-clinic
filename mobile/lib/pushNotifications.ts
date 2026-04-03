import Constants from "expo-constants";
import { Alert, Platform } from "react-native";

import { apiJson } from "@/lib/api";

/**
 * Requests OS permission, obtains Expo push token, POSTs to `/api/user/push-token`.
 * Returns token string or null. Physical device required (native only).
 */
export async function registerForPushAndSyncToken(bearerToken: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  const Notifications = await import("expo-notifications");
  const Device = await import("expo-device");

  if (!Device.isDevice) {
    Alert.alert(
      "Simulator",
      "Push notifications need a physical phone. The in-app bell still shows unread clinic messages."
    );
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "SkinnFit",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0d9488",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") {
    Alert.alert(
      "Notifications disabled",
      "Turn on notifications in system Settings to get alerts when the clinic messages you."
    );
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

    await apiJson<{ success?: boolean }>("/api/user/push-token", bearerToken, {
      method: "POST",
      body: JSON.stringify({ expoPushToken }),
    });
    return expoPushToken;
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Could not register. For release builds, add your EAS projectId under expo.extra.eas in app.json.";
    Alert.alert("Push setup", msg);
    return null;
  }
}

export async function unregisterPushToken(bearerToken: string): Promise<void> {
  await apiJson("/api/user/push-token", bearerToken, {
    method: "POST",
    body: JSON.stringify({ expoPushToken: null }),
  });
}
