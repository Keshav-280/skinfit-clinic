import type { Href } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

    const { notifyInboxUnreadChanged } = await import("@/lib/inboxReadCursors");

    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | null;
      const t = data?.type;
      if (
        t === "clinic_chat" ||
        t === "doctor_voice_note" ||
        t === "routine_plan_updated" ||
        t === "scan_report_ready"
      ) {
        notifyInboxUnreadChanged();
      }
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<
        string,
        unknown
      > | null;
      const t = data?.type;
      if (t === "clinic_chat") {
        const doctorIdRaw = data?.doctorId;
        const doctorId =
          typeof doctorIdRaw === "string" && doctorIdRaw.trim().length > 0
            ? doctorIdRaw.trim()
            : null;
        void (async () => {
          const keys = await AsyncStorage.getAllKeys();
          const stale = keys.filter(
            (k) =>
              k.startsWith("skinfit-chat-thread-v1:") ||
              k === "skinfit-chat-home-v2"
          );
          if (stale.length > 0) {
            await AsyncStorage.multiRemove(stale);
          }
        })().catch(() => {
          /* ignore cache invalidation failures */
        });
        router.push(
          doctorId
            ? (`/(drawer)/chat?doctorId=${encodeURIComponent(doctorId)}` as Href)
            : ("/(drawer)/chat" as Href)
        );
        return;
      }
      if (t === "doctor_voice_note") {
        const onReport = data?.attachedToReport === true;
        router.push((onReport ? "/(drawer)/history" : "/(drawer)") as Href);
        return;
      }
      if (t === "scan_report_ready") {
        const scanId = data?.scanId;
        if (typeof scanId === "number" && scanId > 0) {
          router.push(`/(drawer)/history/${scanId}` as Href);
        } else {
          router.push("/(drawer)/history" as Href);
        }
        return;
      }
      if (t === "scan_report_failed") {
        router.push("/(drawer)/scan" as Href);
        return;
      }
      if (t === "routine_plan_updated") {
        const doctorIdRaw = data?.doctorId;
        const doctorId =
          typeof doctorIdRaw === "string" && doctorIdRaw.trim().length > 0
            ? doctorIdRaw.trim()
            : null;
        router.push(
          doctorId
            ? (`/(drawer)/chat?doctorId=${encodeURIComponent(doctorId)}` as Href)
            : ("/(drawer)" as Href)
        );
      }
    });
  })();
}
