import { describe, expect, it } from "vitest";

import {
  applyScoreReviewEstimates,
  buildScoreReview,
  detectScoreOutliers,
  readScoreReview,
  type ParamValues,
} from "@/src/lib/scoreOutliers";

const scan = (over: ParamValues = {}): ParamValues => ({
  active_acne: 72,
  wrinkles: 75,
  pigmentation: 70,
  acne_scar: 74,
  sagging_volume: 71,
  under_eye: 73,
  ...over,
});

describe("detectScoreOutliers", () => {
  it("does not flag a real low score on its own (could be genuine severe acne)", () => {
    // previous scan was also low: not a sudden drop, and it is not a first scan.
    const flagged = detectScoreOutliers({
      current: scan({ active_acne: 25 }),
      previous: scan({ active_acne: 28 }),
    });
    expect(flagged).toEqual([]);
  });

  it("flags a far-below score that dropped sharply since the last scan", () => {
    const flagged = detectScoreOutliers({
      current: scan({ under_eye: 24 }),
      previous: scan({ under_eye: 70 }),
    });
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ key: "under_eye", reasons: ["sudden_drop"] });
    expect(flagged[0]!.gap).toBeGreaterThanOrEqual(30);
  });

  it("flags an extreme gap on a first scan, where there is nothing to compare with", () => {
    const flagged = detectScoreOutliers({ current: scan({ pigmentation: 22 }), previous: null });
    expect(flagged.map((f) => f.key)).toEqual(["pigmentation"]);
    expect(flagged[0]!.reasons).toEqual(["extreme_first_scan"]);
  });

  it("is more lenient on a first scan: a 30-point gap alone is not enough", () => {
    expect(detectScoreOutliers({ current: scan({ pigmentation: 42 }), previous: null })).toEqual([]);
  });

  it("accepts a retake that agrees with the flagged read as real", () => {
    const flagged = detectScoreOutliers({
      current: scan({ under_eye: 27 }),
      previous: scan({ under_eye: 24 }),
      previousFlaggedKeys: ["under_eye"],
    });
    expect(flagged).toEqual([]);
  });

  it("keeps flagging when the retake is still far from the first read and still dropped", () => {
    const flagged = detectScoreOutliers({
      current: scan({ under_eye: 20 }),
      previous: scan({ under_eye: 60 }),
      previousFlaggedKeys: ["under_eye"],
    });
    expect(flagged.map((f) => f.key)).toEqual(["under_eye"]);
  });

  it("does not flag high outliers", () => {
    const lowScan = scan({
      active_acne: 32, pigmentation: 30, acne_scar: 34, sagging_volume: 31, under_eye: 33, wrinkles: 79,
    });
    expect(detectScoreOutliers({ current: lowScan, previous: null })).toEqual([]);
  });

  it("gives up (flags nothing) when too many areas look wrong, as the whole scan is doubtful", () => {
    const current = scan({ active_acne: 22, wrinkles: 21, pigmentation: 23 });
    const previous = scan();
    expect(detectScoreOutliers({ current, previous })).toEqual([]);
  });

  it("needs enough other areas to judge", () => {
    expect(
      detectScoreOutliers({ current: { active_acne: 20, wrinkles: 75, pigmentation: 70 }, previous: null })
    ).toEqual([]);
  });
});

describe("applyScoreReviewEstimates", () => {
  it("replaces a flagged area with the average of the others", () => {
    const review = buildScoreReview([{ key: "under_eye", gap: 49, reasons: ["sudden_drop"] }]);
    const { values, estimatedKeys } = applyScoreReviewEstimates(scan({ under_eye: 24 }), review);
    expect(estimatedKeys).toEqual(["under_eye"]);
    expect(values.under_eye).toBe(72); // mean of 72, 75, 70, 74, 71
    expect(values.active_acne).toBe(72);
  });

  it("leaves doctor-set areas alone", () => {
    const review = buildScoreReview([{ key: "under_eye", gap: 49, reasons: ["sudden_drop"] }]);
    const { values, estimatedKeys } = applyScoreReviewEstimates(scan({ under_eye: 24 }), review, ["under_eye"]);
    expect(estimatedKeys).toEqual([]);
    expect(values.under_eye).toBe(24);
  });

  it("is a no-op without a review", () => {
    const input = scan({ under_eye: 24 });
    expect(applyScoreReviewEstimates(input, null).values).toBe(input);
  });
});

describe("readScoreReview", () => {
  it("round-trips what is stored and ignores junk", () => {
    const review = buildScoreReview([{ key: "wrinkles", gap: 41, reasons: ["extreme_first_scan"] }]);
    expect(readScoreReview({ scoreReview: review })).toEqual(review);
    expect(readScoreReview({ scoreReview: { flagged: [{ key: "nonsense" }] } })).toBeNull();
    expect(readScoreReview(null)).toBeNull();
    expect(readScoreReview({})).toBeNull();
  });
});
