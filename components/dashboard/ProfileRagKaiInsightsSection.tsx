"use client";

import { useEffect, useState } from "react";
import { BookOpen, Download, Loader2, Lock } from "lucide-react";
import { QuestionnaireLockedCard } from "@/components/dashboard/QuestionnaireLockedCard";
import { downloadMonthlyKaiReportPdf } from "@/src/lib/ragMonthlyReportPdf";
import {
  patientInnerCard,
  patientKicker,
  patientMuted,
  patientPrimaryBtn,
  patientSectionTitle,
} from "@/src/lib/patientDashboardTheme";

type MonthlyInsightPayload = {
  questionnaireLocked?: boolean;
  locked: boolean;
  nextInsightAt: string;
  latestMonthStart: string | null;
  monthly: {
    summaryTitle: string;
    summaryBody: string;
    highlights: string[];
    risks: string[];
    nextMonthFocus: string[];
    kaiMonthAvgFromParams: number | null;
    detail?: Parameters<typeof downloadMonthlyKaiReportPdf>[0];
  } | null;
};

/** Patient-facing date — no time, no jargon. */
function formatNextInsightFriendly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the start of next month";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export function ProfileRagKaiInsightsSection({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<MonthlyInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setErr(null);
      setLoading(true);
      try {
        const res = await fetch("/api/patient/monthly-insight", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setData(null);
            setErr("Could not load monthly insight.");
          }
          return;
        }
        const json = (await res.json()) as MonthlyInsightPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) {
          setData(null);
          setErr("Could not load monthly insight.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPdf = () => {
    if (!data?.monthly?.detail) return;
    downloadMonthlyKaiReportPdf(data.monthly.detail);
  };

  if (loading) {
    return (
      <section
        className="flex items-center gap-3 rounded-[22px] bg-gradient-to-b from-indigo-50/80 to-white px-5 py-6 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] sm:px-6"
        style={{ border: "1px solid #e0e7ff" }}
        aria-busy="true"
      >
        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-indigo-600" />
        <p className="text-sm text-zinc-700">Loading monthly insight…</p>
      </section>
    );
  }

  if (err && !data) {
    return (
      <section
        className="rounded-[22px] bg-zinc-50 px-5 py-5 sm:px-6"
        style={{ border: "1px solid #e4e4e7" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-indigo-500" aria-hidden />
          <h2 className="text-base font-bold text-zinc-900">Monthly insight</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-600">{err}</p>
      </section>
    );
  }

  if (!data) return null;

  if (data.questionnaireLocked) {
    return (
      <QuestionnaireLockedCard
        title="Monthly kAI insights are locked"
        description="Finish the onboarding questionnaire so kAI can personalise your monthly summary."
      />
    );
  }

  const monthly = data.monthly;
  const nextInsightFriendly = formatNextInsightFriendly(data.nextInsightAt);
  const monthKai = monthly?.kaiMonthAvgFromParams ?? null;

  const body = (
    <>
      {!embedded ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className={patientMuted}>
            A once-a-month recap from your scans and daily check-ins.
          </p>
          <button
            type="button"
            onClick={onPdf}
            disabled={!monthly?.detail}
            className={patientPrimaryBtn}
          >
            <Download className="h-4 w-4" aria-hidden />
            Monthly PDF
          </button>
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onPdf}
            disabled={!monthly?.detail}
            className={patientPrimaryBtn}
          >
            <Download className="h-4 w-4" aria-hidden />
            Monthly PDF
          </button>
        </div>
      )}

      {data.locked || !monthly ? (
        <div className={`${patientInnerCard} px-4 py-4`}>
          <p className={`inline-flex items-center gap-2 ${patientKicker}`}>
            <Lock className="h-4 w-4" aria-hidden />
            Not ready yet
          </p>
          <p className={`mt-2 text-sm leading-relaxed ${patientMuted}`}>
            Your monthly summary unlocks 1 month after your first scan — around{" "}
            <span className="font-semibold text-[#2C3E6B]">{nextInsightFriendly}</span>.
            Keep scanning and logging — we&apos;ll pull it together for you.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl bg-[#2C3E6B] px-4 py-4 text-white shadow-sm lg:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">
              Month kAI
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {monthKai != null ? monthKai : "—"}
            </p>
            <p className="mt-2 text-xs leading-snug text-white/75">
              Your overall skin score for the month.
            </p>
          </div>
          <div className={`${patientInnerCard} px-4 py-4 lg:col-span-2`}>
            <p className={patientKicker}>{monthly.summaryTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#374151]">
              {monthly.summaryBody}
            </p>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Highlights</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#374151]">
              {(monthly.highlights ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Risks</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#374151]">
              {(monthly.risks ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className={`${patientInnerCard} p-4`}>
            <p className={patientKicker}>Next focus</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[#374151]">
              {(monthly.nextMonthFocus ?? []).slice(0, 4).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) return body;

  return (
    <section className="space-y-4">
      <h2 className={patientSectionTitle}>Monthly insight</h2>
      {body}
    </section>
  );
}
