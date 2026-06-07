export type ObservationRow = {
  text: string;
  dateLabel?: string;
  source?: "baseline_scan" | "daily_logs" | "scan_trend" | "weekly_report";
};

export type SkinProfileForWeekly = {
  keyObservations?: {
    modeLabel: string;
    logDaysUsed: string[];
    scanDaysUsed: string[];
    baselineScanDateYmd: string | null;
    weeklyAverageKaiScore?: number | null;
    items: Array<{
      text: string;
      source: "baseline_scan" | "daily_logs" | "scan_trend" | "weekly_report";
      dateLabel: string;
    }>;
  };
  priorityKnowDo?: { know: string[]; do: string[] };
  insightsUnavailable?: boolean;
  observationsUnavailable?: boolean;
  actionsUnavailable?: boolean;
  scanCount?: number;
  kaiInsightsEnabled?: boolean;
  weeklyInsight?: {
    locked: boolean;
    nextInsightAt: string | null;
  };
};

export type WeeklyHomeSnapshot = {
  kaiSkinScore: number;
  weeklyDeltaScore: number;
  kaiInsightsEnabled?: boolean;
};

export type WeeklyInsightViewModel = {
  hasWeeklyContent: boolean;
  card: {
    locked: boolean;
    nextInsightAt: string | null;
    kaiScore: number;
    weeklyDelta: number;
    consistency: string;
    dateRange: string;
    showTrend: boolean;
    observations: ObservationRow[];
    dataUsedSummary: string | null;
    priorityActions: string[];
    observationsUnavailable: boolean;
    actionsUnavailable: boolean;
  };
};

export function buildWeeklyInsightViewModel(
  skinExtra: SkinProfileForWeekly | null,
  home: WeeklyHomeSnapshot | null
): WeeklyInsightViewModel {
  const hasRealScoreData = home != null && home.kaiSkinScore > 0;
  const keyObs = skinExtra?.keyObservations;

  const weeklyAverageScore =
    keyObs?.weeklyAverageKaiScore != null && keyObs.weeklyAverageKaiScore > 0
      ? Math.min(100, Math.max(0, Math.round(keyObs.weeklyAverageKaiScore)))
      : hasRealScoreData
        ? Math.min(100, Math.max(0, Math.round(home!.kaiSkinScore)))
        : 0;

  const weeklyDelta = hasRealScoreData ? Math.round(home!.weeklyDeltaScore) : 0;

  const hasWeeklyScore =
    weeklyAverageScore > 0 ||
    (keyObs?.scanDaysUsed?.length ?? 0) > 0 ||
    hasRealScoreData;

  const consistency = !hasWeeklyScore
    ? "No data"
    : Math.abs(weeklyDelta) <= 3
      ? "Good"
      : Math.abs(weeklyDelta) <= 8
        ? "Fair"
        : "Needs work";

  const weeklyDateRange =
    keyObs?.modeLabel ??
    (() => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      return `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
    })();

  const observations: ObservationRow[] =
    keyObs?.items?.map((item) => ({
      text: item.text,
      dateLabel: item.dateLabel,
      source: item.source,
    })) ?? [];

  const dataUsedSummary = keyObs
    ? [
        keyObs.logDaysUsed.length > 0
          ? `Daily logs: ${keyObs.logDaysUsed.length} day${keyObs.logDaysUsed.length === 1 ? "" : "s"}`
          : null,
        keyObs.scanDaysUsed.length > 0
          ? `Scans in window: ${keyObs.scanDaysUsed.length}`
          : null,
        keyObs.baselineScanDateYmd
          ? `Baseline: ${new Date(`${keyObs.baselineScanDateYmd}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const priorityActions = skinExtra?.priorityKnowDo?.do?.slice(0, 3) ?? [];

  const kaiInsightsEnabled =
    skinExtra?.kaiInsightsEnabled !== false && home?.kaiInsightsEnabled !== false;
  const insightsUnavailable =
    !kaiInsightsEnabled || skinExtra?.insightsUnavailable === true;
  const observationsUnavailable =
    !kaiInsightsEnabled ||
    (skinExtra?.observationsUnavailable ?? insightsUnavailable);
  const actionsUnavailable =
    !kaiInsightsEnabled ||
    (skinExtra?.actionsUnavailable ?? insightsUnavailable);

  const scanCount = skinExtra?.scanCount ?? (hasRealScoreData ? 1 : 0);
  const showTrend = hasRealScoreData && scanCount >= 2;

  const weeklyLocked = skinExtra?.weeklyInsight?.locked ?? true;
  const weeklyNextAt = skinExtra?.weeklyInsight?.nextInsightAt ?? null;

  const hasWeeklyContent =
    kaiInsightsEnabled &&
    scanCount > 0 &&
    (weeklyLocked ||
      hasWeeklyScore ||
      observations.length > 0 ||
      priorityActions.length > 0 ||
      insightsUnavailable);

  return {
    hasWeeklyContent,
    card: {
      locked: weeklyLocked,
      nextInsightAt: weeklyNextAt,
      kaiScore: weeklyAverageScore,
      weeklyDelta,
      consistency,
      dateRange: weeklyDateRange,
      showTrend,
      observations,
      dataUsedSummary,
      priorityActions,
      observationsUnavailable,
      actionsUnavailable,
    },
  };
}

export const SKIN_PROFILE_CACHE_KEY = "skin-profile";
