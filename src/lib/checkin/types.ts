import type { CheckinConcernPath } from "@/src/lib/checkin/definitions";

export type CheckinAnswers = {
  sleep_hours: string | null;
  stress: string | null;
  water: string | null;
  nutrition: string[];
  exercise_hours: string | null;
  supplements: string[];
  concernSpecific: Record<string, string | string[] | number | null>;
};

export function emptyCheckinAnswers(): CheckinAnswers {
  return {
    sleep_hours: null,
    stress: null,
    water: null,
    nutrition: [],
    exercise_hours: null,
    supplements: [],
    concernSpecific: {},
  };
}

export type WeeklyCheckInPayload = {
  checkin_id: string;
  scan_id: string | null;
  week_number: number;
  completed_at: string;
  primary_concern: CheckinConcernPath;
  universal: {
    sleep_hours: string;
    stress: string;
    water: string;
    nutrition: string[];
    exercise_hours: string;
    supplements: string[];
  };
  concern_specific: Record<string, string | string[] | number | null>;
  auto_detected: {
    city: string | null;
    uv_index_peak: number | null;
    humidity_pct_avg: number | null;
    humidity_delta_pct: number | null;
    aqi_avg: number | null;
    temp_c_avg: number | null;
  };
  flags: string[];
};

export function computeCheckinFlags(opts: {
  concern: CheckinConcernPath;
  answers: CheckinAnswers;
  priorWeeks: Array<{
    concernSpecific: Record<string, string | string[] | number | null> | null;
    flags: string[] | null;
    weekYmd: string;
  }>;
}): string[] {
  const flags = new Set<string>();
  const cs = opts.answers.concernSpecific;

  if (cs.lesion_type === "cystic") {
    flags.add("possible_cystic_acne");
  }

  const hormonal = Array.isArray(cs.hormonal) ? cs.hormonal : [];
  if (hormonal.includes("pregnant_or_postpartum")) {
    flags.add("pregnancy_contraindication");
  }

  if (cs.shed_rate === "100+") {
    const priorShed = opts.priorWeeks.some(
      (w) => w.concernSpecific?.shed_rate === "100+"
    );
    if (priorShed) flags.add("accelerated_shedding");
  }

  if (cs.adherence === "barely") {
    const barelyCount =
      1 +
      opts.priorWeeks.filter((w) => w.concernSpecific?.adherence === "barely")
        .length;
    if (barelyCount >= 3) flags.add("adherence_risk");
  }

  if (cs.weight_change === "down_1kg_plus") {
    const downWeeks =
      1 +
      opts.priorWeeks.filter(
        (w) => w.concernSpecific?.weight_change === "down_1kg_plus"
      ).length;
    if (downWeeks >= 4) flags.add("rapid_loss_review");
  }

  // Soft flag from build brief: painful/deep + many — map cystic already covered;
  // also flag painful + 10+
  if (cs.lesion_type === "painful" && cs.new_lesions === "10+") {
    flags.add("possible_cystic_acne");
  }

  return [...flags];
}
