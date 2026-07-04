"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MonthlyInsightView,
  MonthlyInsightViewError,
  type MonthlyInsightViewData,
} from "@/components/dashboard/MonthlyInsightView";

export function ProfileRagKaiInsightsSection({
  embedded = false,
  compact = false,
}: {
  embedded?: boolean;
  compact?: boolean;
}) {
  const [data, setData] = useState<MonthlyInsightViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (monthStart?: string | null, isSwitch = false) => {
    if (isSwitch) setHistoryLoading(true);
    else setLoading(true);
    setErr(null);
    try {
      const qs = monthStart
        ? `?monthStart=${encodeURIComponent(monthStart)}`
        : "";
      const res = await fetch(`/api/patient/monthly-insight${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setData(null);
        setErr("Could not load monthly insight.");
        return;
      }
      const json = (await res.json()) as MonthlyInsightViewData;
      setData(json);
    } catch {
      setData(null);
      setErr("Could not load monthly insight.");
    } finally {
      setLoading(false);
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    if (embedded && compact) {
      return (
        <div className="flex items-center gap-2 py-1 text-xs text-zinc-600" aria-busy="true">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
          Loading monthly insight…
        </div>
      );
    }
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
    return <MonthlyInsightViewError message={err} />;
  }

  if (!data) return null;

  return (
    <MonthlyInsightView
      data={data}
      embedded={embedded}
      compact={compact}
      showPdfButton
      historyLoading={historyLoading}
      onSelectMonth={(monthStart) => {
        if (monthStart === data.selectedMonthStart) return;
        void load(monthStart, true);
      }}
    />
  );
}
