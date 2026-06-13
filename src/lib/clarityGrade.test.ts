import { describe, expect, it } from "vitest";

import {
  clarityToGrade,
  classifySkinParamMetric,
  gradeSublabel,
  patientClarityToGrade,
  patientDisplayClarity,
} from "@/src/lib/clarityGrade";

describe("patientDisplayClarity", () => {
  it("saturates high raw scores near 80", () => {
    expect(patientDisplayClarity(100)).toBeLessThanOrEqual(80);
    expect(patientDisplayClarity(97)).toBeGreaterThanOrEqual(78);
    expect(patientDisplayClarity(97)).toBeLessThanOrEqual(80);
    expect(patientDisplayClarity(96)).toBeLessThan(patientDisplayClarity(100));
  });

  it("preserves sensitivity in mid range", () => {
    expect(patientDisplayClarity(40)).toBeGreaterThan(30);
    expect(patientDisplayClarity(40)).toBeLessThan(50);
    expect(patientDisplayClarity(60)).toBeGreaterThan(55);
  });
});

describe("clarityToGrade", () => {
  it("maps display clarity bands A–E", () => {
    expect(clarityToGrade(100)).toBe("A");
    expect(clarityToGrade(80)).toBe("A");
    expect(clarityToGrade(79)).toBe("B");
    expect(clarityToGrade(60)).toBe("B");
    expect(clarityToGrade(59)).toBe("C");
    expect(clarityToGrade(40)).toBe("C");
    expect(clarityToGrade(39)).toBe("D");
    expect(clarityToGrade(20)).toBe("D");
    expect(clarityToGrade(19)).toBe("E");
    expect(clarityToGrade(0)).toBe("E");
  });
});

describe("patientClarityToGrade", () => {
  it("maps inflated raw scores to B, not A", () => {
    expect(patientClarityToGrade(96)).toBe("B");
    expect(patientClarityToGrade(97)).toBe("B");
  });
});

describe("classifySkinParamMetric", () => {
  it("derives sublabel from calibrated grade", () => {
    const high = classifySkinParamMetric(96);
    expect(high.grade).toBe("B");
    expect(high.displayScore).toBeLessThanOrEqual(80);
    expect(classifySkinParamMetric(15).grade).toBe("E");
    expect(classifySkinParamMetric(85).sublabel).toBe(gradeSublabel("B"));
  });
});
