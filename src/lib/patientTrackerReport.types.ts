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
  weeklyDeltaMeaningful: boolean;
};

export type PatientTrackerReport = {
  hookSentence: string;
  scores: {
    kaiScore: number;
    weeklyDelta: number;
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
};
