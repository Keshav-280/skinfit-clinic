import { describe, expect, it } from "vitest";

import {
  computeScoreChange,
  describeScoreChange,
  formatSignedDelta,
  MIN_DETECTABLE_CHANGE,
  type ScorePoint,
} from "@/src/lib/scoreChange";

const series = (...values: number[]): ScorePoint[] =>
  values.map((value, i) => ({ value, at: new Date(2026, 9, 1 + i * 7) }));

describe("computeScoreChange", () => {
  it("returns null for a first scan", () => {
    expect(computeScoreChange(series(60))).toBeNull();
    expect(computeScoreChange([])).toBeNull();
  });

  it("uses the last scan when it already shows a real change", () => {
    const c = computeScoreChange(series(60, 66))!;
    expect(c.direction).toBe("up");
    expect(c.horizon).toBe("last");
    expect(c.delta).toBe(6);
  });

  it("looks two scans back when the last step is within noise", () => {
    // 60 → 62 → 63: the last step is +1 (below the threshold) but the 2-scan move is +3.
    const c = computeScoreChange(series(60, 62, 63))!;
    expect(MIN_DETECTABLE_CHANGE).toBe(3);
    expect(c.direction).toBe("up");
    expect(c.horizon).toBe("two_back");
    expect(c.delta).toBe(3);
    expect(c.lastDelta).toBe(1);
  });

  it("reports a decline hidden by a small last step", () => {
    const c = computeScoreChange(series(70, 62, 61))!;
    expect(c.direction).toBe("down");
    expect(c.horizon).toBe("two_back");
    expect(c.delta).toBe(-9);
  });

  it("falls back to the first scan for slow drift over a longer history", () => {
    // The last step is +1 and the two-scan move is +2, but across all four scans it is +3.
    const c = computeScoreChange(series(50, 51, 52, 53))!;
    expect(c.horizon).toBe("first");
    expect(c.direction).toBe("up");
    expect(c.delta).toBe(3);
  });

  it("treats a 2-point move as steady", () => {
    expect(computeScoreChange(series(60, 62))!.direction).toBe("steady");
    expect(computeScoreChange(series(62, 60))!.direction).toBe("steady");
  });

  it("says steady when nothing clears the threshold, and does not invent movement", () => {
    const c = computeScoreChange(series(60, 61, 60, 61))!;
    expect(c.direction).toBe("steady");
    expect(c.horizon).toBe("last");
    expect(describeScoreChange(c)).toBe("Steady since your last scan");
  });

  it("prefers the nearest horizon that clears the threshold", () => {
    const c = computeScoreChange(series(40, 55, 58))!;
    expect(c.horizon).toBe("last");
    expect(c.delta).toBe(3);
  });

  it("skips scans with no value for this parameter", () => {
    const pts = series(60, 62, 63);
    pts.splice(1, 0, { value: NaN, at: new Date(2026, 9, 5) });
    expect(computeScoreChange(pts)!.horizon).toBe("two_back");
  });
});

describe("describeScoreChange", () => {
  it("names the scan the change is measured from", () => {
    const c = computeScoreChange(series(60, 61, 66.4))!;
    expect(c.horizon).toBe("last");
    expect(describeScoreChange(c)).toBe("Up 5 since your last scan");
    const two = computeScoreChange(series(60, 62, 63))!;
    expect(describeScoreChange(two)).toMatch(/^Up 3 since \d+ [A-Z][a-z]{2}$/);
    const first = computeScoreChange(series(50, 51, 52, 53))!;
    expect(describeScoreChange(first)).toBe("Up 3 since you started");
  });
});

describe("formatSignedDelta", () => {
  it("adds a sign", () => {
    expect(formatSignedDelta(4)).toBe("+4");
    expect(formatSignedDelta(-3)).toBe("-3");
    expect(formatSignedDelta(0)).toBe("0");
  });
});
