"use client";

import { useEffect, useState } from "react";
import { BookOpen, Download, Loader2, Lock } from "lucide-react";
import { downloadMonthlyKaiReportPdf } from "@/src/lib/ragMonthlyReportPdf";

type MonthlyInsightPayload = {
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

export function ProfileRagKaiInsightsSection() {
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
  const monthly = data.monthly;
  const nextInsightLabel = new Date(data.nextInsightAt).toLocaleString();
  const monthKai = monthly?.kaiMonthAvgFromParams ?? null;

  return (
    <section
      className="overflow-hidden rounded-[22px] bg-gradient-to-b from-indigo-50/90 to-white shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)]"
      style={{ border: "1px solid #e0e7ff" }}
    >
      <div className="border-b border-indigo-100/80 bg-gradient-to-r from-indigo-100/50 to-transparent px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-800 shadow-sm">
              <BookOpen className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">
                Monthly insight
              </h2>
              <p className="mt-1 max-w-xl text-sm text-zinc-600">
                Cron-based monthly summary. Unlocks after the scheduled monthly run.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPdf}
              disabled={!monthly?.detail}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(67,56,202,0.45)] transition hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" aria-hidden />
              Monthly PDF
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span>
            Next cron window: {nextInsightLabel}
          </span>
        </div>

        {data.locked || !monthly ? (
          <div
            className="rounded-xl bg-white/90 px-4 py-4 text-sm text-zinc-800"
            style={{ border: "1px solid #e0e7ff" }}
          >
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-800">
              <Lock className="h-4 w-4" aria-hidden />
              Locked until next monthly run
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              Next insight on <span className="font-semibold">{nextInsightLabel}</span> (cron).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div
              className="rounded-xl bg-indigo-600/95 px-4 py-4 text-white shadow-inner lg:col-span-1"
              style={{ border: "1px solid #4338ca" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-100">
                Month kAI
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums">
                {monthKai != null ? monthKai : "—"}
              </p>
              <p className="mt-2 text-xs leading-snug text-indigo-100/90">
                Weighted month score from mean of 8 parameters.
              </p>
            </div>
            <div
              className="rounded-xl bg-white/95 px-4 py-4 lg:col-span-2"
              style={{ border: "1px solid #e8e2d8" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                {monthly.summaryTitle}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-800">
                {monthly.summaryBody}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white/95 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                Highlights
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
                {(monthly.highlights ?? []).slice(0, 4).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-100 bg-white/95 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                Risks
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
                {(monthly.risks ?? []).slice(0, 4).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-violet-100 bg-white/95 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
                Next focus
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-700">
                {(monthly.nextMonthFocus ?? []).slice(0, 4).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
