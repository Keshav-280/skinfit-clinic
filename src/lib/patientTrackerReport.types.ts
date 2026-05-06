export type PatientTrackerCause = {
  text: string;
  impact: "high" | "medium" | "low";
};

export type PatientTrackerFocusAction = {
  rank: number;
  title: string;
  detail: string;
};

export type PatientTrackerResource = {
  title: string;
  url: string;
  kind: "article" | "video" | "insight";
};

export type PatientTrackerParamRow = {
  key: string;
  label: string;
  value: number | null;
  source: string;
  /** Δ vs immediate prior scan (only when both scans have model values for this key). */
  delta: number | null;
  /** Value on the immediate prior scan when model-backed; otherwise null. */
  prevScanValue: number | null;
  /**
   * Average of model-backed samples for this parameter from scans in the calendar week
   * before this scan's week (among scans at or before this one).
   */
  prevWeekAverage: number | null;
  /** Rounded (display value − prevWeekAverage) when a previous-week average exists. */
  weekAvgDelta: number | null;
  weeklyDeltaMeaningful: boolean;
};

export type KaiOnboardingClinical = {
  flags: string[];
  notes: string[];
};

export type PatientTrackerReport = {
  scanContext: {
    kind: "onboarding_first_scan" | "same_week_followup" | "new_week_followup";
    title: string;
    subtitle: string;
  };
  hookSentence: string;
  insightText: string;
  predictionText: string;
  scores: {
    kaiScore: number;
    /** Main comparison delta shown in UI; mode depends on `deltaMode`. */
    weeklyDelta: number;
    deltaMode: "last_scan" | "week_average";
    /** Always computed when a prior scan exists. */
    lastScanDelta: number | null;
    /** Computed for cross-week comparisons (week-average vs prior-week-average). */
    weekAverageDelta: number | null;
    currentWeekAverageKai: number | null;
    previousWeekAverageKai: number | null;
    consistencyScore: number;
  };
  skinPills: string[];
  paramRows: PatientTrackerParamRow[];
  causes: PatientTrackerCause[];
  focusActions: PatientTrackerFocusAction[];
  resources: PatientTrackerResource[];
  cta: {
    showAppointmentPrep: boolean;
    appointmentWithin7Days: boolean;
  };
  /** Questionnaire-derived flags/notes for kAI report (chronic, sensitivity, triggers, sleep). */
  onboardingClinical?: KaiOnboardingClinical | null;
};
