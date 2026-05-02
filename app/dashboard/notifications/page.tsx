"use client";

import Link from "next/link";
import { Calendar, ChevronRight, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/src/lib/clinicSupportInboxClient";

export default function DashboardNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
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
        supportCount?: number;
        doctorCount?: number;
      };
      if (!res.ok || !data.success) {
        setUnreadTotal(0);
        setSupportCount(0);
        setDoctorCount(0);
        return;
      }
      setUnreadTotal(typeof data.total === "number" ? data.total : 0);
      setSupportCount(
        typeof data.supportCount === "number" ? data.supportCount : 0
      );
      setDoctorCount(
        typeof data.doctorCount === "number" ? data.doctorCount : 0
      );
    } catch {
      setUnreadTotal(0);
      setSupportCount(0);
      setDoctorCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Clinic messages and in-app alerts. Open chat to read the care team.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          <Link
            href="/dashboard/chat"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/40"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-zinc-900">Chat with clinic</p>
              <p className="mt-1 text-sm text-zinc-600">
                {unreadTotal === 0
                  ? "No unread messages from Support or your doctor."
                  : `${unreadTotal} unread from the care team.`}
              </p>
              {(supportCount > 0 || doctorCount > 0) && (
                <p className="mt-2 text-xs font-semibold text-teal-700">
                  {supportCount > 0 ? `Support: ${supportCount}` : ""}
                  {supportCount > 0 && doctorCount > 0 ? " · " : ""}
                  {doctorCount > 0 ? `Doctor: ${doctorCount}` : ""}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
          </Link>

          <Link
            href="/dashboard/schedules"
            className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Calendar className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-zinc-900">Schedules & calendar</p>
              <p className="mt-1 text-sm text-zinc-600">
                Your appointments and calendar.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
          </Link>

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-800">On the mobile app</p>
            <p className="mt-2 leading-relaxed">
              You can turn on push alerts so a new clinic chat message can notify
              you when the app isn&apos;t open. The website always shows unread
              counts here and on the bell in the header.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
