import { describe, expect, it } from "vitest";

import {
  clarityToGrade,
  classifySkinParamMetric,
  gradeColor,
  gradeSublabel,
  patientClarityToGrade,
  patientDisplayClarity,
  patientGradeWithRange,
  patientKaiScoreView,
  patientScoreView,
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

describe("gradeColor", () => {
  it("maps A/B green, C orange, D/E red", () => {
    expect(gradeColor("A")).toBe("#4CAF50");
    expect(gradeColor("B")).toBe("#4CAF50");
    expect(gradeColor("C")).toBe("#F59E0B");
    expect(gradeColor("D")).toBe("#DC2626");
    expect(gradeColor("E")).toBe("#DC2626");
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

describe("patientScoreView", () => {
  it("shows grade range when locked", () => {
    const locked = patientScoreView(72, false);
    expect(locked.locked).toBe(true);
    expect(locked.label).toBe(patientGradeWithRange(72));
    expect(locked.label).toMatch(/^\w+ \(\d+–\d+\)$/);
  });

  it("shows exact calibrated score when unlocked", () => {
    const unlocked = patientScoreView(72, true);
    expect(unlocked.locked).toBe(false);
    expect(unlocked.label).toBe(String(patientDisplayClarity(72)));
  });
});

describe("patientKaiScoreView", () => {
  it("locks kAI with grade range hint", () => {
    const locked = patientKaiScoreView(72, false);
    expect(locked.showLock).toBe(true);
    expect(locked.kaiPrimary).toBe("—");
    expect(locked.kaiSecondary).toContain("·");
  });

  it("shows exact score when unlocked", () => {
    const unlocked = patientKaiScoreView(72, true);
    expect(unlocked.showLock).toBe(false);
    expect(unlocked.kaiPrimary).toBe(String(patientDisplayClarity(72)));
  });
});
