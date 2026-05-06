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
    { ring: string; bg: string; iconBg: string; iconFg: string; chevron: string }
  > = {
    rose: {
      ring: "ring-rose-200/90",
      bg: "bg-gradient-to-br from-rose-50/95 to-white",
      iconBg: "bg-rose-100",
      iconFg: "text-rose-700",
      chevron: "text-rose-500",
    },
    teal: {
      ring: "ring-teal-200/90",
      bg: "bg-gradient-to-br from-teal-50/95 to-white",
      iconBg: "bg-teal-100",
      iconFg: "text-teal-800",
      chevron: "text-teal-600",
    },
    sky: {
      ring: "ring-sky-200/90",
      bg: "bg-gradient-to-br from-sky-50/95 to-white",
      iconBg: "bg-sky-100",
      iconFg: "text-sky-800",
      chevron: "text-sky-600",
    },
    violet: {
      ring: "ring-violet-200/90",
      bg: "bg-gradient-to-br from-violet-50/95 to-white",
      iconBg: "bg-violet-100",
      iconFg: "text-violet-800",
      chevron: "text-violet-600",
    },
  };
  const t = tones[tone];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl border border-white/80 p-4 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] ring-1 ${t.ring} ${t.bg} transition hover:shadow-md hover:ring-2`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${t.iconBg} ${t.iconFg} shadow-sm`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold tracking-tight text-zinc-900">{title}</p>
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-800 shadow-sm ring-1 ring-zinc-200/80">
            {count}
          </span>
        </div>
        <p className="mt-1 text-sm leading-snug text-zinc-600">{subtitle}</p>
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
      className="flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50/60"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold text-zinc-900">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
    </Link>
  );
}

export default function DashboardNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [supportCount, setSupportCount] = useState(0);
  const [doctorCount, setDoctorCount] = useState(0);
  const [voiceNoteGeneralCount, setVoiceNoteGeneralCount] = useState(0);
  const [voiceNoteReportCount, setVoiceNoteReportCount] = useState(0);

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

  useEffect(() => {
    void load();
  }, [load]);

  const alertCount = useMemo(
    () =>
      supportCount +
      doctorCount +
      voiceNoteGeneralCount +
      voiceNoteReportCount,
    [supportCount, doctorCount, voiceNoteGeneralCount, voiceNoteReportCount]
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
    <div className="mx-auto max-w-lg space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Notifications
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Tap an item to open it. Voice rows can clear the bell when opened.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {alertCount > 0 ? "Needs attention" : "Inbox"}
              </h2>
              {alertCount === 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  All caught up
                </span>
              ) : (
                <span className="text-xs font-semibold tabular-nums text-zinc-500">
                  {alertCount} active
                </span>
              )}
            </div>

            <div className="space-y-2.5">
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
            <h2 className="px-0.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              More
            </h2>
            <ShortcutRow
              href="/dashboard/schedules"
              icon={<Calendar className="h-5 w-5" aria-hidden />}
              title="Schedules & calendar"
              subtitle="Appointments and reminders."
            />
          </section>

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-800">Mobile app</p>
            <p className="mt-2 leading-relaxed">
              Turn on push for alerts when SkinnFit isn&apos;t open. On the web,
              the bell only shows how many items need attention — details are
              listed here.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
