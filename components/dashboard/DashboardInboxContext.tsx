"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  CLINIC_SUPPORT_INBOX_EVENT,
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/src/lib/clinicSupportInboxClient";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { patientInboxTypeParts } from "@/src/lib/patientNotificationInboxSummary";
import {
  getUnreadReadyScanCount,
  SCAN_READY_CHANGED_EVENT,
} from "@/src/lib/scanJobNotifications";

const POLL_MS = 15_000;

export type DashboardInboxCounts = {
  total: number;
  supportCount: number;
  doctorCount: number;
  voiceNoteGeneralCount: number;
  voiceNoteReportCount: number;
  scanReadyCount: number;
  /** Inbox unread + unread scan reports (bell badge). */
  bellTotal: number;
  /** Joined type labels for bell accessibility. */
  typesFull: string;
};

const defaultCounts: DashboardInboxCounts = {
  total: 0,
  supportCount: 0,
  doctorCount: 0,
  voiceNoteGeneralCount: 0,
  voiceNoteReportCount: 0,
  scanReadyCount: 0,
  bellTotal: 0,
  typesFull: "",
};

const Ctx = createContext<DashboardInboxCounts>(defaultCounts);

export function DashboardInboxProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<DashboardInboxCounts>(defaultCounts);

  const refreshScanReady = useCallback(() => {
    const scanReadyCount = getUnreadReadyScanCount();
    setCounts((prev) => {
      const bellTotal = prev.total + scanReadyCount;
      const types = patientInboxTypeParts({
        supportCount: prev.supportCount,
        doctorCount: prev.doctorCount,
        voiceNoteGeneralCount: prev.voiceNoteGeneralCount,
        voiceNoteReportCount: prev.voiceNoteReportCount,
      });
      if (scanReadyCount > 0) {
        types.push(
          scanReadyCount === 1
            ? "scan report ready"
            : `${scanReadyCount} scan reports ready`
        );
      }
      return {
        ...prev,
        scanReadyCount,
        bellTotal,
        typesFull: types.join(" · "),
      };
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const supportSince = getClinicSupportInboxLastSeenIso();
      const doctorSince = getDoctorInboxLastSeenIso();
      const q = new URLSearchParams({ supportSince, doctorSince });
      const res = await fetch(`/api/chat/inbox/unread?${q.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        success?: boolean;
        total?: number;
        hasMore?: boolean;
        supportCount?: number;
        doctorCount?: number;
        voiceNoteGeneralCount?: number;
        voiceNoteReportCount?: number;
      };
      const scanReadyCount = getUnreadReadyScanCount();
      if (!res.ok || !data.success) {
        setCounts({ ...defaultCounts, scanReadyCount, bellTotal: scanReadyCount });
        return;
      }
      const n = typeof data.total === "number" ? data.total : 0;
      const capped = data.hasMore ? 100 : n;
      const parts = {
        supportCount:
          typeof data.supportCount === "number" ? data.supportCount : 0,
        doctorCount: typeof data.doctorCount === "number" ? data.doctorCount : 0,
        voiceNoteGeneralCount:
          typeof data.voiceNoteGeneralCount === "number"
            ? data.voiceNoteGeneralCount
            : 0,
        voiceNoteReportCount:
          typeof data.voiceNoteReportCount === "number"
            ? data.voiceNoteReportCount
            : 0,
      };
      const types = patientInboxTypeParts(parts);
      if (scanReadyCount > 0) {
        types.push(
          scanReadyCount === 1
            ? "scan report ready"
            : `${scanReadyCount} scan reports ready`
        );
      }
      setCounts({
        total: capped,
        ...parts,
        scanReadyCount,
        bellTotal: capped + scanReadyCount,
        typesFull: types.join(" · "),
      });
    } catch {
      const scanReadyCount = getUnreadReadyScanCount();
      setCounts({ ...defaultCounts, scanReadyCount, bellTotal: scanReadyCount });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    refreshScanReady();
    const onReady = () => refreshScanReady();
    window.addEventListener(SCAN_READY_CHANGED_EVENT, onReady);
    return () => window.removeEventListener(SCAN_READY_CHANGED_EVENT, onReady);
  }, [refreshScanReady]);

  useEffect(() => {
    const bump = () => void refresh();
    window.addEventListener(CLINIC_SUPPORT_INBOX_EVENT, bump);
    window.addEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, bump);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, bump);
    window.addEventListener(SCAN_READY_CHANGED_EVENT, bump);
    window.addEventListener("focus", bump);
    window.addEventListener("pageshow", bump);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(CLINIC_SUPPORT_INBOX_EVENT, bump);
      window.removeEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, bump);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, bump);
      window.removeEventListener(SCAN_READY_CHANGED_EVENT, bump);
      window.removeEventListener("focus", bump);
      window.removeEventListener("pageshow", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  return <Ctx.Provider value={counts}>{children}</Ctx.Provider>;
}

export function useDashboardInbox() {
  return useContext(Ctx);
}
