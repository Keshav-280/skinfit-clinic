"use client";

import { useCallback, useEffect, useState } from "react";

import { WeeklyReportCard } from "@/components/dashboard/WeeklyReportCard";
import {
  buildWeeklyInsightViewModel,
  type SkinProfileForWeekly,
  type WeeklyHomeSnapshot,
} from "@/src/lib/weeklyInsightModel";

type Props = {
  home: WeeklyHomeSnapshot | null;
  className?: string;
  /** Bump when dashboard finishes a home refresh. */
  reloadNonce?: number;
};

export function WeeklyInsightSection({ home, className = "", reloadNonce = 0 }: Props) {
  const [skinExtra, setSkinExtra] = useState<SkinProfileForWeekly | null>(null);

  const loadSkinProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/patient/skin-profile", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as SkinProfileForWeekly;
      setSkinExtra(json);
    } catch {
      /* keep cached / empty */
    }
  }, []);

  useEffect(() => {
    void loadSkinProfile();
  }, [loadSkinProfile, reloadNonce]);

  const model = buildWeeklyInsightViewModel(skinExtra, home);
  if (!model.hasWeeklyContent) return null;

  return (
    <WeeklyReportCard
      className={className}
      locked={model.card.locked}
      nextInsightAt={model.card.nextInsightAt}
      kaiScore={model.card.kaiScore}
      weeklyDelta={model.card.weeklyDelta}
      consistency={model.card.consistency}
      dateRange={model.card.dateRange}
      showTrend={model.card.showTrend}
      observations={model.card.observations}
      dataUsedSummary={model.card.dataUsedSummary}
      priorityActions={model.card.priorityActions}
      observationsUnavailable={model.card.observationsUnavailable}
      actionsUnavailable={model.card.actionsUnavailable}
      scoresUnlocked={home?.scoresUnlocked ?? false}
    />
  );
}
