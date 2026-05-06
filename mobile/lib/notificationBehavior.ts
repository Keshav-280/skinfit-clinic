import type { Href } from "expo-router";
import { Platform } from "react-native";

let configured = false;

/** Call once on app load (native only). Foreground banners + tap → Chat. */
export function configureNotificationBehavior() {
  if (Platform.OS === "web" || configured) return;
  configured = true;

  void (async () => {
    const [Notifications, { router }] = await Promise.all([
      import("expo-notifications"),
      import("expo-router"),
    ]);

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<
        string,
        unknown
      > | null;
      const t = data?.type;
      if (t === "clinic_chat") {
        router.push("/(drawer)/chat");
        return;
      }
      if (t === "doctor_voice_note") {
        const onReport = data?.attachedToReport === true;
        router.push((onReport ? "/(drawer)/history" : "/(drawer)") as Href);
      }
    });
  })();
}
