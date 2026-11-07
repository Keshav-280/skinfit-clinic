import { describe, expect, it } from "vitest";
import { scanDisplayResolvedFromRow } from "@/src/lib/resolveScanDisplayScores";

const modelFeatureScores = {
  pigmentation_model: 1,
  wrinkles: 1,
  under_eye: 1,
  acne_scars: 1,
  sagging_volume: 1,
};

function top(scores: Record<string, unknown>) {
  return scanDisplayResolvedFromRow({
    overallScore: 90,
    acne: 90,
    wrinkles: 90,
    pigmentation: 90,
    hydration: 90,
    texture: 90,
    scores: { modelFeatureScores, ...scores },
  }).resolvedRagParamValues;
}

describe("one scan, one score", () => {
  it("a 4th scan before a clinic visit tops out at 82", () => {
    const v = top({ scanOrdinal: 4, displayUnlocked: false });
    expect(v.pigmentation).toBe(82);
    expect(v.wrinkles).toBe(82);
    expect(v.under_eye).toBe(82);
  });

  it("without the scan number the scan is scored against a different ceiling (the old Score tab copy)", () => {
    // This is the mismatch: the same scan reads higher when the scan number is missing.
    expect(top({}).pigmentation!).toBeGreaterThan(top({ scanOrdinal: 4 }).pigmentation!);
  });

  it("the same stored scan resolves identically however many times it is read", () => {
    const scores = { scanOrdinal: 4, displayUnlocked: false };
    expect(top(scores)).toEqual(top({ ...scores }));
  });
});
