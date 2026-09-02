/**
 * Sagging & volume: composite 1-5 severity (higher = worse laxity / contour concern).
 *
 * Raw ML `sagging_volume` is chubby/double-chin (facial fullness), which poorly
 * matches clinical sagging. We blend contour with under-eye hollowing and wrinkle
 * laxity - signals that track structural ageing more reliably on 2D scans.
 *
 * Age adjustment (0-100 clarity) compares observed composite severity to
 * age-expected norms from facial ageing literature:
 * - Collagen/elastin decline accelerates from ~35 (Johns Hopkins Medicine)
 * - Cheek sagging becomes morphologically distinct in the ~40s (photonumeric scale, PMC)
 * - Progressive mid-face volume loss and laxity through 50s+ (dermatology reviews)
 */

export type SaggingCompositeModelScores = {
  sagging_volume?: number | null;
  sagging_contour_severity?: number | null;
  under_eye?: number | null;
  wrinkle_severity?: number | null;
};

/** Weights for contour (ISGD chubby/chin), under-eye hollowing, wrinkle laxity. */
const WEIGHTS = {
  contour: 0.3,
  underEye: 0.35,
  wrinkles: 0.35,
} as const;

export type SaggingCompositeInputs = {
  contourSeverity?: number | null;
  underEyeSeverity?: number | null;
  wrinkleSeverity?: number | null;
};

function clampSeverity(s: number): number {
  return Math.round(Math.max(1, Math.min(5, s)) * 100) / 100;
}

/** Weighted mean of available 1-5 severities; renormalizes when a signal is missing. */
export function compositeSaggingVolumeSeverity(
  inputs: SaggingCompositeInputs
): number | null {
  const parts: { v: number; w: number }[] = [];
  if (
    typeof inputs.contourSeverity === "number" &&
    Number.isFinite(inputs.contourSeverity)
  ) {
    parts.push({ v: inputs.contourSeverity, w: WEIGHTS.contour });
  }
  if (
    typeof inputs.underEyeSeverity === "number" &&
    Number.isFinite(inputs.underEyeSeverity)
  ) {
    parts.push({ v: inputs.underEyeSeverity, w: WEIGHTS.underEye });
  }
  if (
    typeof inputs.wrinkleSeverity === "number" &&
    Number.isFinite(inputs.wrinkleSeverity)
  ) {
    parts.push({ v: inputs.wrinkleSeverity, w: WEIGHTS.wrinkles });
  }
  if (parts.length === 0) return null;
  const totalW = parts.reduce((sum, p) => sum + p.w, 0);
  const blended = parts.reduce((sum, p) => sum + p.v * p.w, 0) / totalW;
  return clampSeverity(blended);
}

/** Replace `sagging_volume` with composite; preserve raw contour as `sagging_contour_severity`. */
export function applyCompositeSaggingVolume<T extends SaggingCompositeModelScores>(
  mfs: T
): T {
  const contour = mfs.sagging_volume;
  const composite = compositeSaggingVolumeSeverity({
    contourSeverity: contour,
    underEyeSeverity: mfs.under_eye,
    wrinkleSeverity: mfs.wrinkle_severity,
  });
  if (composite == null) return mfs;
  return {
    ...mfs,
    sagging_contour_severity:
      typeof contour === "number" ? contour : mfs.sagging_contour_severity ?? null,
    sagging_volume: composite,
  };
}

/** Expected composite sagging severity for chronological age (1-5, higher = more laxity). */
export function ageExpectedSaggingSeverity(age: number): number {
  const a = Math.max(18, Math.min(90, age));
  if (a < 30) return 1.75;
  if (a < 35) return 1.75 + (a - 30) * 0.05;
  if (a < 40) return 2.0 + (a - 35) * 0.06;
  if (a < 50) return 2.3 + (a - 40) * 0.06;
  if (a < 60) return 2.9 + (a - 50) * 0.05;
  if (a < 70) return 3.4 + (a - 60) * 0.04;
  return 3.8 + (a - 70) * 0.02;
}

function severityToClarity(severity: number): number {
  const s = Math.max(1, Math.min(5, severity));
  return Math.round(100 - ((s - 1) / 4) * 100);
}

/** 0-100 clarity vs age-matched peers; without age, falls back to raw severity mapping. */
export function ageAdjustedSaggingClarity(
  observedSeverity: number,
  age: number | null | undefined
): number {
  if (age == null || !Number.isFinite(age) || age < 18 || age > 100) {
    return severityToClarity(observedSeverity);
  }
  const expected = ageExpectedSaggingSeverity(age);
  const delta = observedSeverity - expected;
  const clarity = Math.round(78 - delta * 18);
  return Math.max(0, Math.min(100, clarity));
}

export function saggingVolumeCompositeExtras(
  mfs: SaggingCompositeModelScores,
  age?: number | null
): Record<string, unknown> {
  const composite = mfs.sagging_volume;
  const base: Record<string, unknown> = {
    scoring: "composite_v1_age_v1",
    contour_severity_1_5: mfs.sagging_contour_severity ?? composite,
    under_eye_severity_1_5: mfs.under_eye,
    wrinkle_severity_1_5: mfs.wrinkle_severity,
    composite_severity_1_5: composite,
  };
  if (
    age != null &&
    Number.isFinite(age) &&
    age >= 18 &&
    typeof composite === "number"
  ) {
    const expected = ageExpectedSaggingSeverity(age);
    base.patient_age = age;
    base.age_expected_severity_1_5 = Math.round(expected * 100) / 100;
    base.age_delta_severity_1_5 = Math.round((composite - expected) * 100) / 100;
    base.age_adjusted_clarity_0_100 = ageAdjustedSaggingClarity(composite, age);
  }
  return base;
}
