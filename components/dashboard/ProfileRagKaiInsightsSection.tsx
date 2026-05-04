"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Download, Loader2, Sparkles } from "lucide-react";
import type { RagKaiTestPackage } from "@/src/lib/ragKaiTestService";
import { downloadMonthlyKaiReportPdf } from "@/src/lib/ragMonthlyReportPdf";

type ApiOk = { ok: true; output: RagKaiTestPackage };
type ApiErr = { error: string; message?: string };

export function ProfileRagKaiInsightsSection() {
  const [data, setData] = useState<RagKaiTestPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/patient/rag-kai-insights", {
        credentials: "include",
      });
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok) {
        if (res.status === 400 && "message" in json && json.message) {
          setData(null);
          setErr(json.message);
          return;
        }
        setData(null);
        setErr("Could not load kAI insights.");
        return;
      }
      if (!("output" in json) || !json.output) {
        setData(null);
        setErr("Invalid response.");
        return;
      }
      setData(json.output);
    } catch {
      setData(null);
      setErr("Could not load kAI insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setGenerating(true);
    setErr(null);
    try {
      await load();
    } finally {
      setGenerating(false);
    }
  };

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
        <p className="text-sm text-zinc-700">Loading textbook-backed kAI insights…</p>
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
          <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden />
          <h2 className="text-base font-bold text-zinc-900">kAI deep insights</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-600">{err}</p>
      </section>
    );
  }

  if (!data) return null;

  const monthly = data.monthly;
  const monthKai = monthly.kaiMonthAvgFromParams;
  const identity = data.skinIdentityTimeline;

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
                kAI deep insights
              </h2>
              <p className="mt-1 max-w-xl text-sm text-zinc-600">
                Evidence-leaning readouts from your scans, journal, and dermatology
                references — same engine as your clinical test console.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              Regenerate
            </button>
            <button
              type="button"
              onClick={onPdf}
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
            Updated {new Date(data.generatedAt).toLocaleString()} · {data.totalScans} scans ·{" "}
            {data.llm.enabled ? "LLM synthesis on" : "Template mode (no LLM)"}
          </span>
        </div>

        {identity.changed.length > 0 ? (
          <div
            className="rounded-xl bg-white/90 px-4 py-3 text-sm text-zinc-800"
            style={{ border: "1px solid #e0e7ff" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-800">
              Skin identity updates
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
              {identity.changed.slice(0, 5).map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.field}</span>:{" "}
                  <span className="text-zinc-600">
                    {String(c.from ?? "—")} → {String(c.to ?? "—")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <div
            className="rounded-xl bg-indigo-600/95 px-4 py-4 text-white shadow-inner lg:col-span-1"
            style={{ border: "1px solid #4338ca" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-100">
              Month kAI (μ parameters)
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {monthKai != null ? monthKai : "—"}
            </p>
            <p className="mt-2 text-xs leading-snug text-indigo-100/90">
              Average of your eight kAI parameters across scans this month, then the same
              weighted score as a single scan — not an average of per-scan kAIs.
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
            {monthly.highlights.length > 0 ? (
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-700">
                {monthly.highlights.slice(0, 4).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {data.days.length > 0 ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Latest daily focus
            </p>
            <p className="mt-2 text-sm text-zinc-800">
              {data.days[data.days.length - 1]?.focusMessage}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
