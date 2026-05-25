import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import {
  addUnreadReadyScan,
  dismissUnreadReadyScan,
  getPendingScanJobs,
  removePendingScanJob,
} from "@/lib/scanJobNotifications";
import { presentScanReportReadyNotification } from "@/lib/scanReadyLocalNotification";

const POLL_MS = 8_000;
const NAVY = "#2C3E6B";

type ReadyItem = { scanId: number; title: string };

export function ScanJobReadyNotifier() {
  const { token } = useAuth();
  const router = useRouter();
  const [item, setItem] = useState<ReadyItem | null>(null);

  const poll = useCallback(async () => {
    if (!token) return;
    const pending = await getPendingScanJobs();
    if (pending.length === 0) return;

    for (const job of pending) {
      try {
        const data = await apiJson<{
          status?: string;
          scanId?: number | null;
        }>(`/api/scans/status/${encodeURIComponent(job.jobId)}`, token, {
          method: "GET",
        });
        const status = String(data.status ?? "");
        const scanId =
          typeof data.scanId === "number" && data.scanId > 0
            ? data.scanId
            : null;

        if (status === "completed" && scanId) {
          await removePendingScanJob(job.jobId);
          const title =
            job.scanName?.trim() ||
            "Your full scan report is ready to view";
          const isNew = await addUnreadReadyScan(scanId, title);
          if (isNew) {
            void presentScanReportReadyNotification(scanId, title);
            setItem({ scanId, title });
          }
          return;
        }
        if (status === "failed") {
          await removePendingScanJob(job.jobId);
        }
      } catch {
        /* retry */
      }
    }
  }, [token]);

  useEffect(() => {
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void poll();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [poll]);

  if (!item) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>Your report is ready</Text>
        <Text style={styles.sub}>{item.title}</Text>
        <Text style={styles.hint}>
          Images, masks, and kAI analysis are saved — opening is instant.
        </Text>
        <View style={styles.row}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              const id = item.scanId;
              void dismissUnreadReadyScan(id);
              setItem(null);
              router.push(`/(drawer)/history/${id}`);
            }}
          >
            <Text style={styles.primaryText}>Open report</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void dismissUnreadReadyScan(item.scanId);
              setItem(null);
            }}
          >
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 100,
    zIndex: 50,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(44,62,107,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  title: { fontSize: 15, fontWeight: "700", color: NAVY },
  sub: { marginTop: 4, fontSize: 14, color: "#52525b" },
  hint: { marginTop: 6, fontSize: 12, color: "#71717a", lineHeight: 17 },
  row: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  primaryBtn: {
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  dismiss: { color: "#71717a", fontWeight: "600", fontSize: 13 },
});
