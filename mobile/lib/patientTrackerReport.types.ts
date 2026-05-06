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
  delta: number | null;
  prevScanValue: number | null;
  prevWeekAverage: number | null;
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
    weeklyDelta: number;
    deltaMode: "last_scan" | "week_average";
    lastScanDelta: number | null;
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
  onboardingClinical?: KaiOnboardingClinical | null;
};
