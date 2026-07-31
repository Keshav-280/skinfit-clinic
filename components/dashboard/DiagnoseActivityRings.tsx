"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";
import {
  SkinParamMetricsCard,
  classifySkinParamMetric,
} from "@/components/dashboard/SkinParamMetricsCard";
import { analysisResultsToParams } from "@/src/lib/skinScanAnalysis";

type RingsHome = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  lifestyleAlignmentScore: number;
  scoresUnlocked?: boolean;
  skinScanHistory: Array<{ createdAt: string; analysisResults?: unknown }>;
};

/**
 * Diagnose hero: activity rings + skin parameter metrics.
 * Loads the same `/api/patient/home` payload used on Build.
 */
export function DiagnoseActivityRings() {
  const [data, setData] = useState<RingsHome | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ymd = format(new Date(), "yyyy-MM-dd");
    void fetch(`/api/patient/home?date=${encodeURIComponent(ymd)}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("home");
        return (await r.json()) as RingsHome;
      })
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const skinParams = useMemo(() => {
    const analysis = data?.skinScanHistory[0]?.analysisResults;
    if (!analysis) return [];
    return analysisResultsToParams(analysis).map((p) => ({
      ...p,
      ...classifySkinParamMetric(p.value),
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-[20px] border border-[#E5E7EB] bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#2C3E6B]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <NavyMetricsCard
        kaiSkinScore={data.kaiSkinScore}
        weeklyDeltaScore={data.weeklyDeltaScore}
        weeklyDeltaMeaningful={data.weeklyDeltaMeaningful !== false}
        latestScanAt={data.skinScanHistory[0]?.createdAt ?? null}
        consistencyScore={data.lifestyleAlignmentScore}
        scoresUnlocked={data.scoresUnlocked ?? false}
      />
      {skinParams.length > 0 ? (
        <SkinParamMetricsCard
          metrics={skinParams}
          viewAllHref="/dashboard/skin-params"
          scoresUnlocked={data.scoresUnlocked ?? false}
        />
      ) : null}
    </div>
  );
}
