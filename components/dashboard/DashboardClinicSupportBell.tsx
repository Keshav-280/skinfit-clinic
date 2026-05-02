"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import {
  CLINIC_SUPPORT_INBOX_EVENT,
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/src/lib/clinicSupportInboxClient";

/** Routine reminders + clinic messages all land in the support thread; this badge reflects unread counts. */
const POLL_MS = 15_000;

export function DashboardClinicSupportBell() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    try {
      const supportSince = getClinicSupportInboxLastSeenIso();
      const doctorSince = getDoctorInboxLastSeenIso();
      const q = new URLSearchParams({
        supportSince,
        doctorSince,
      });
      const res = await fetch(`/api/chat/inbox/unread?${q.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        success?: boolean;
        total?: number;
        hasMore?: boolean;
      };
      if (!res.ok || !data.success) {
        setCount(0);
        return;
      }
      const n = typeof data.total === "number" ? data.total : 0;
      setCount(data.hasMore ? 100 : n);
    } catch {
      setCount(0);
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
    const bump = () => void refresh();
    window.addEventListener(CLINIC_SUPPORT_INBOX_EVENT, bump);
    window.addEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, bump);
    window.addEventListener("focus", bump);
    window.addEventListener("pageshow", bump);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(CLINIC_SUPPORT_INBOX_EVENT, bump);
      window.removeEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, bump);
      window.removeEventListener("focus", bump);
      window.removeEventListener("pageshow", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const label =
    count >= 100
      ? "Many new clinic chat messages"
      : count > 0
        ? `${count} new message${count === 1 ? "" : "s"} from Clinic Support or Dr. Ruby`
        : "Clinic chat messages";

  return (
    <Link
      href="/dashboard/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
      title={label}
      aria-label={label}
    >
      <Bell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
          {count >= 100 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
