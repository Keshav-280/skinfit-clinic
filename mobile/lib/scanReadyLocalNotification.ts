import { Platform } from "react-native";

/** Foreground/background banner when a scan report finishes (no server push required). */
export async function presentScanReportReadyNotification(
  scanId: number,
  title: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your report is ready",
        body: title,
        data: { type: "scan_report_ready", scanId },
        sound: true,
      },
      trigger: null,
    });
  } catch {
    /* best-effort */
  }
}
