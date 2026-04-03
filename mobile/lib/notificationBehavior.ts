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
      const t = response.notification.request.content.data?.type;
      if (t === "clinic_chat") {
        router.push("/(drawer)/chat");
      }
    });
  })();
}
