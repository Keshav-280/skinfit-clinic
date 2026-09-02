"use client";

import { useCallback, useEffect, useState } from "react";
import { InlineSkeleton, SectionSkeleton } from "@/components/dashboard/PageSkeletons";
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
        <div className="py-1" aria-busy="true">
          <InlineSkeleton label="Loading monthly insight" />
        </div>
      );
    }
    return (
      <section
        className="rounded-[22px] bg-white/50 px-5 py-6 shadow-[0_8px_28px_-4px_rgba(15,23,42,0.07)] sm:px-6"
        style={{ border: "1px solid #F0EAE2" }}
        aria-busy="true"
      >
        <SectionSkeleton label="Loading monthly insight" />
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
