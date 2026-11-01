import { describe, expect, it } from "vitest";

import { continuousAcneSeverity } from "@/src/lib/acneContinuousSeverity";

const sev = (lesionCount: number, areaPercent: number, worstTypeLevel: number) =>
  continuousAcneSeverity({ lesionCount, areaPercent, worstTypeLevel })!;

describe("continuousAcneSeverity", () => {
  it("separates counts that the old buckets treated as identical", () => {
    // 12 and 19 lesions were both bucket "D" (10-20).
    expect(sev(19, 8, 2)).toBeGreaterThan(sev(12, 8, 2));
    // 3 and 9 lesions were both bucket "C".
    expect(sev(9, 8, 2)).toBeGreaterThan(sev(3, 8, 2));
  });

  it("moves on every lesion, not only at bucket edges", () => {
    for (let n = 0; n < 30; n++) {
      expect(sev(n + 1, 5, 2)).toBeGreaterThanOrEqual(sev(n, 5, 2));
    }
    expect(sev(11, 5, 2)).toBeGreaterThan(sev(10, 5, 2));
  });

  it("matches the old bucket value at the centre of each bucket", () => {
    // count 6 (bucket C = 3), type 3, area 10% (bucket C = 3) → 3.0 in both systems
    expect(sev(6, 10, 3)).toBeCloseTo(3, 5);
    // clear skin → 1
    expect(sev(0, 0, 1)).toBe(1);
  });

  it("never reads a nodule or cyst as mild", () => {
    expect(sev(1, 0.5, 5)).toBeGreaterThanOrEqual(4);
  });

  it("stays inside 1-5 and rejects unusable input", () => {
    expect(sev(500, 90, 5)).toBe(5);
    expect(continuousAcneSeverity({ lesionCount: NaN, areaPercent: 1, worstTypeLevel: 2 })).toBeNull();
    expect(continuousAcneSeverity({})).toBeNull();
  });
});
