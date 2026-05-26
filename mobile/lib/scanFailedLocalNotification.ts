import { Platform } from "react-native";

/** Foreground/background banner when a scan job permanently fails. */
export async function presentScanReportFailedNotification(
  jobId: string,
  title: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Scan couldn't finish",
        body: `${title} — we retried several times. Please run a new scan.`,
        data: { type: "scan_report_failed", jobId },
        sound: true,
      },
      trigger: null,
    });
  } catch {
    /* best-effort */
  }
}
