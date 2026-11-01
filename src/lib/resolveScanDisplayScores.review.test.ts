import { describe, expect, it } from "vitest";

import {
  buildDoctorScoreEditMeta,
  ragParamValuesWithReview,
  resolveScanDisplayScores,
} from "@/src/lib/resolveScanDisplayScores";
import { patientDisplayClarity } from "@/src/lib/clarityGrade";

// Raw clarity (pre-curve) per column; sagging comes from kaiParams.
const columns = {
  overallScore: 70,
  acne: 80,
  wrinkles: 85,
  pigmentation: 75,
  hydration: 12, // under-eye: far below the rest
  texture: 82, // acne scar
};
const baseScores = { kaiParams: { sagging_volume: { value: 78 } } };
const flagged = {
  version: 1,
  flagged: [{ key: "under_eye", gap: 50, reasons: ["sudden_drop"] }],
};

const row = (scores: unknown) => ({ ...columns, scores });

describe("outlier estimates in score resolution", () => {
  it("leaves a scan untouched when nothing is flagged", () => {
    const { values, estimatedKeys } = ragParamValuesWithReview(row(baseScores));
    expect(estimatedKeys).toEqual([]);
    expect(values.under_eye).toBe(patientDisplayClarity(12));
  });

  it("replaces a flagged area with the average of the others", () => {
    const { values, estimatedKeys } = ragParamValuesWithReview(
      row({ ...baseScores, scoreReview: flagged })
    );
    expect(estimatedKeys).toEqual(["under_eye"]);
    const others = [80, 85, 75, 82, 78].map(patientDisplayClarity);
    const mean = Math.round(others.reduce((s, x) => s + x, 0) / others.length);
    expect(values.under_eye).toBe(mean);
    expect(values.under_eye).toBeGreaterThan(patientDisplayClarity(12) + 30);
  });

  it("feeds the estimate into the overall kAI score", () => {
    const plain = resolveScanDisplayScores({
      scoresJson: baseScores,
      baseMetricsColumns: columns,
    });
    const reviewed = resolveScanDisplayScores({
      scoresJson: { ...baseScores, scoreReview: flagged },
      baseMetricsColumns: columns,
    });
    expect(reviewed.estimatedKeys).toEqual(["under_eye"]);
    expect(reviewed.metrics.overall_score).toBeGreaterThan(plain.metrics.overall_score);
    expect(reviewed.metrics.hydration).toBe(reviewed.resolvedRagParamValues.under_eye);
  });

  it("can return the model's own read for the doctor", () => {
    const raw = resolveScanDisplayScores({
      scoresJson: { ...baseScores, scoreReview: flagged },
      baseMetricsColumns: columns,
      applyReview: false,
    });
    expect(raw.estimatedKeys).toEqual([]);
    expect(raw.resolvedRagParamValues.under_eye).toBe(patientDisplayClarity(12));

    const meta = buildDoctorScoreEditMeta({ ...baseScores, scoreReview: flagged }, columns);
    expect(meta.aiBase.parameterScores.under_eye).toBe(patientDisplayClarity(12));
    expect(meta.estimatedKeys).toEqual(["under_eye"]);
    expect(meta.currentDisplay.parameterScores.under_eye).toBeGreaterThan(50);
  });

  it("never overwrites a score a doctor has set", () => {
    const scores = {
      ...baseScores,
      scoreReview: flagged,
      doctorOverrides: { parameterScores: { under_eye: 33 }, patientDisplayScale: 2 },
    };
    const { values, estimatedKeys } = ragParamValuesWithReview(row(scores));
    expect(estimatedKeys).toEqual([]);
    expect(values.under_eye).toBe(33);
  });
});
