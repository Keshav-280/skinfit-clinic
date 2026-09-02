"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { NavyMetricsCard } from "@/components/dashboard/NavyMetricsCard";
import { InlineSkeleton } from "@/components/dashboard/PageSkeletons";
import { webPatientScoresUnlocked } from "@/src/lib/webPatientScores";

type RingsHome = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  weeklyDeltaMeaningful?: boolean;
  lifestyleAlignmentScore: number;
  scoresUnlocked?: boolean;
  skinScanHistory: Array<{ createdAt: string; analysisResults?: unknown }>;
};

/**
 * Diagnose hero: activity rings.
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

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <InlineSkeleton label="Loading scores" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-0.5 pt-1">
      <NavyMetricsCard
        light
        kaiSkinScore={data.kaiSkinScore}
        weeklyDeltaScore={data.weeklyDeltaScore}
        weeklyDeltaMeaningful={data.weeklyDeltaMeaningful !== false}
        latestScanAt={data.skinScanHistory[0]?.createdAt ?? null}
        consistencyScore={data.lifestyleAlignmentScore}
        scoresUnlocked={webPatientScoresUnlocked(data.scoresUnlocked)}
        scanCount={data.skinScanHistory.length}
      />
    </div>
  );
}
