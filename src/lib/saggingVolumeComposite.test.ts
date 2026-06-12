import { describe, expect, it } from "vitest";

import {
  ageAdjustedSaggingClarity,
  ageExpectedSaggingSeverity,
  applyCompositeSaggingVolume,
  compositeSaggingVolumeSeverity,
} from "@/src/lib/saggingVolumeComposite";

describe("compositeSaggingVolumeSeverity", () => {
  it("blends contour, under-eye, and wrinkles with renormalized weights", () => {
    const s = compositeSaggingVolumeSeverity({
      contourSeverity: 1,
      underEyeSeverity: 3,
      wrinkleSeverity: 5,
    });
    expect(s).toBe(3.1);
  });

  it("works when only two signals are present", () => {
    const s = compositeSaggingVolumeSeverity({
      underEyeSeverity: 4,
      wrinkleSeverity: 2,
    });
    expect(s).toBe(3);
  });
});

describe("applyCompositeSaggingVolume", () => {
  it("stores raw contour and replaces sagging_volume with composite", () => {
    const out = applyCompositeSaggingVolume({
      sagging_volume: 1.5,
      under_eye: 3,
      wrinkle_severity: 4,
    });
    expect(out.sagging_contour_severity).toBe(1.5);
    expect(out.sagging_volume).toBeGreaterThan(1.5);
    expect(out.sagging_volume).toBeLessThan(4);
  });
});

describe("ageExpectedSaggingSeverity", () => {
  it("rises through key clinical age bands", () => {
    expect(ageExpectedSaggingSeverity(25)).toBeCloseTo(1.75, 2);
    expect(ageExpectedSaggingSeverity(35)).toBeCloseTo(2.0, 2);
    expect(ageExpectedSaggingSeverity(40)).toBeCloseTo(2.3, 2);
    expect(ageExpectedSaggingSeverity(50)).toBeCloseTo(2.9, 2);
    expect(ageExpectedSaggingSeverity(60)).toBeGreaterThan(3.2);
  });
});

describe("ageAdjustedSaggingClarity", () => {
  it("scores at peer expectation near baseline clarity", () => {
    const age = 42;
    const expected = ageExpectedSaggingSeverity(age);
    expect(ageAdjustedSaggingClarity(expected, age)).toBe(78);
  });

  it("penalizes worse-than-age sagging and rewards better", () => {
    const age = 42;
    const expected = ageExpectedSaggingSeverity(age);
    expect(ageAdjustedSaggingClarity(expected + 1, age)).toBe(60);
    expect(ageAdjustedSaggingClarity(expected - 1, age)).toBe(96);
  });

  it("falls back to raw severity mapping without age", () => {
    expect(ageAdjustedSaggingClarity(3, null)).toBe(50);
  });
});
