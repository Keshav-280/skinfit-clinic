"use client";

import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Headphones,
  Mic,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
} from "@/src/lib/clinicSupportInboxClient";
import {
  dismissUnreadReadyScan,
  getUnreadReadyScans,
  SCAN_READY_CHANGED_EVENT,
  type ReadyScanNotification,
} from "@/src/lib/scanJobNotifications";

function countLabel(n: number, one: string, many: string) {
  return n === 1 ? one : many.replace("{n}", String(n));
}

type AlertTone = "rose" | "teal" | "sky" | "violet";

function AlertRow({
  href,
  onClick,
  icon,
  title,
  subtitle,
  count,
  tone,
}: {
  href: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  tone: AlertTone;
}) {
  const tones: Record<
    AlertTone,
    { border: string; bg: string; iconBg: string; iconFg: string; chevron: string }
  > = {
    rose: {
      border: "border-rose-200/60",
      bg: "bg-white/35",
      iconBg: "bg-rose-100/80",
      iconFg: "text-rose-700",
      chevron: "text-rose-500",
    },
    teal: {
      border: "border-teal-200/60",
      bg: "bg-white/35",
      iconBg: "bg-teal-100/80",
      iconFg: "text-teal-800",
      chevron: "text-teal-600",
    },
    sky: {
      border: "border-sky-200/60",
      bg: "bg-white/35",
      iconBg: "bg-sky-100/80",
      iconFg: "text-sky-800",
      chevron: "text-sky-600",
    },
    violet: {
      border: "border-violet-200/60",
      bg: "bg-white/35",
      iconBg: "bg-violet-100/80",
      iconFg: "text-violet-800",
      chevron: "text-violet-600",
    },
  };
  const t = tones[tone];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3.5 rounded-[18px] border ${t.border} ${t.bg} p-4 backdrop-blur-sm transition hover:bg-white/80 hover:shadow-md`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.iconBg} ${t.iconFg} backdrop-blur-sm`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold tracking-tight text-[#2C3E6B]">{title}</p>
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[#2C3E6B] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
            {count}
          </span>
        </div>
        <p className="mt-1 text-sm leading-snug text-[#6B7280]">{subtitle}</p>
      </div>
      <ChevronRight
        className={`h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 ${t.chevron}`}
      />
    </Link>
  );
}

function ShortcutRow({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[18px] border border-white/70 bg-white/35 p-4 backdrop-blur-sm transition hover:bg-white/80"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8EFE6]/60 text-[#2C3E6B]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold text-[#2C3E6B]">{title}</p>
        <p className="mt-0.5 text-sm text-[#6B7280]">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#2C3E6B]/40" />
    </Link>
  );
}

export default function DashboardNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [supportCount, setSupportCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [voiceNoteGeneralCount, setVoiceNoteGeneralCount] = useState(0);
  const [voiceNoteReportCount, setVoiceNoteReportCount] = useState(0);
  const [readyScans, setReadyScans] = useState<ReadyScanNotification[]>([]);

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
        supportCount?: number;
        doctorCount?: number;
        voiceNoteGeneralCount?: number;
        voiceNoteReportCount?: number;
      };
      if (!res.ok || !data.success) {
        setSupportCount(0);
        setDoctorCount(0);
        setVoiceNoteGeneralCount(0);
        setVoiceNoteReportCount(0);
        return;
      }
      setSupportCount(
        typeof data.supportCount === "number" ? data.supportCount : 0
      );
      setDoctorCount(
        typeof data.doctorCount === "number" ? data.doctorCount : 0
      );
      setVoiceNoteGeneralCount(
        typeof data.voiceNoteGeneralCount === "number"
          ? data.voiceNoteGeneralCount
          : 0
      );
      setVoiceNoteReportCount(
        typeof data.voiceNoteReportCount === "number"
          ? data.voiceNoteReportCount
          : 0
      );
    } catch {
      setSupportCount(0);
      setDoctorCount(0);
      setVoiceNoteGeneralCount(0);
      setVoiceNoteReportCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshReadyScans = useCallback(() => {
    setReadyScans(getUnreadReadyScans());
  }, []);

  useEffect(() => {
    void load();
    refreshReadyScans();
  }, [load, refreshReadyScans]);

  useEffect(() => {
    const onReady = () => refreshReadyScans();
    window.addEventListener(SCAN_READY_CHANGED_EVENT, onReady);
    return () => window.removeEventListener(SCAN_READY_CHANGED_EVENT, onReady);
  }, [refreshReadyScans]);

  const alertCount = useMemo(
    () =>
      supportCount +
      doctorCount +
      voiceNoteGeneralCount +
      voiceNoteReportCount +
      readyScans.length,
    [
      supportCount,
      doctorCount,
      voiceNoteGeneralCount,
      voiceNoteReportCount,
      readyScans.length,
    ]
  );

  function markVoiceViewedThenRefresh(scope: "dashboard" | "report") {
    void fetch("/api/patient/doctor-feedback/viewed", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    })
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
        }
        void load();
      })
      .catch(() => {
        void load();
      });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-[22px] border border-white/70 bg-white/35 px-6 py-5 text-center backdrop-blur-sm">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2C3E6B]">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Tap an item to open it. Voice rows can clear the bell when opened.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-[#6B7280]">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#2C3E6B]/60">
                {alertCount > 0 ? "Needs attention" : "Inbox"}
              </h2>
              {alertCount === 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-[#E8EFE6]/80 px-2.5 py-1 text-xs font-semibold text-[#2C3E6B] backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  All caught up
                </span>
              ) : (
                <span className="text-xs font-semibold tabular-nums text-[#2C3E6B]/60">
                  {alertCount} active
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {readyScans.map((scan) => (
                <AlertRow
                  key={scan.scanId}
                  href={`/dashboard/history/scans/${scan.scanId}`}
                  onClick={() => dismissUnreadReadyScan(scan.scanId)}
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                  title="Scan report ready"
                  subtitle={scan.title}
                  count={1}
                  tone="teal"
                />
              ))}

              {supportCount > 0 ? (
                <AlertRow
                  href="/dashboard/chat?assistant=support"
                  icon={<Headphones className="h-5 w-5" aria-hidden />}
                  title={countLabel(
                    supportCount,
                    "1 support chat pending",
                    "{n} support chats pending"
                  )}
                  subtitle="Open Clinic Support to read and reply."
                  count={supportCount}
                  tone="teal"
                />
              ) : null}

              {doctorCount > 0 ? (
                <AlertRow
                  href="/dashboard/chat?assistant=doctor"
                  icon={<Stethoscope className="h-5 w-5" aria-hidden />}
                  title={countLabel(
                    doctorCount,
                    "1 doctor message pending",
                    "{n} doctor messages pending"
                  )}
                  subtitle="Your care team in the doctor thread."
                  count={doctorCount}
                  tone="rose"
                />
              ) : null}

              {supportCount === 0 && doctorCount === 0 ? (
                <ShortcutRow
                  href="/dashboard/chat?assistant=support"
                  icon={<Headphones className="h-5 w-5" aria-hidden />}
                  title="Chat with clinic"
                  subtitle="No unread support or doctor messages."
                />
              ) : null}

              {voiceNoteGeneralCount > 0 ? (
                <AlertRow
                  href="/dashboard#doctor-feedback"
                  onClick={() => markVoiceViewedThenRefresh("dashboard")}
                  icon={<Mic className="h-5 w-5" aria-hidden />}
                  title={countLabel(
                    voiceNoteGeneralCount,
                    "1 new home voice note",
                    "{n} new home voice notes"
                  )}
                  subtitle="From Doctor’s feedback on your dashboard."
                  count={voiceNoteGeneralCount}
                  tone="sky"
                />
              ) : null}

              {voiceNoteReportCount > 0 ? (
                <AlertRow
                  href="/dashboard/history"
                  onClick={() => markVoiceViewedThenRefresh("report")}
                  icon={<Mic className="h-5 w-5" aria-hidden />}
                  title={countLabel(
                    voiceNoteReportCount,
                    "1 new scan voice note",
                    "{n} new scan voice notes"
                  )}
                  subtitle="In Treatment history → Audio notes."
                  count={voiceNoteReportCount}
                  tone="violet"
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-0.5 text-xs font-bold uppercase tracking-wider text-[#2C3E6B]/60">
              More
            </h2>
            <ShortcutRow
              href="/dashboard/schedules"
              icon={<Calendar className="h-5 w-5" aria-hidden />}
              title="Schedules & calendar"
              subtitle="Appointments and reminders."
            />
          </section>

          <div className="rounded-[18px] border border-dashed border-white/70 bg-white/40 p-4 text-sm text-[#6B7280] backdrop-blur-sm">
            <p className="font-semibold text-[#2C3E6B]">Mobile app</p>
            <p className="mt-2 leading-relaxed">
              Turn on push for alerts when SkinnFit isn&apos;t open. On the web,
              the bell counts unread chat, voice notes, and scan reports ready —
              details are listed here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
