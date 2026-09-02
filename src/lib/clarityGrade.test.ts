import { describe, expect, it } from "vitest";

import {
  clarityToGrade,
  classifySkinParamMetric,
  gradeColor,
  gradeSublabel,
  patientClarityToGrade,
  patientDisplayClarity,
  patientGradeFromDisplayScore,
  patientGradeWithRange,
  patientKaiScoreView,
  patientScoreView,
  patientUnlockedDisplayScore,
  PATIENT_DISPLAY_SCORE_FLOOR,
} from "@/src/lib/clarityGrade";

describe("patientDisplayClarity", () => {
  it("saturates high raw scores below 80 (no grade A band)", () => {
    expect(patientDisplayClarity(100)).toBeLessThan(80);
    expect(patientDisplayClarity(100)).toBeLessThanOrEqual(79);
    expect(patientClarityToGrade(100)).toBe("B");
    expect(patientClarityToGrade(97)).toBe("B");
    expect(patientDisplayClarity(97)).toBeGreaterThanOrEqual(78);
  });

  it("preserves sensitivity in mid range", () => {
    expect(patientDisplayClarity(40)).toBeGreaterThan(30);
    expect(patientDisplayClarity(40)).toBeLessThan(50);
    expect(patientDisplayClarity(60)).toBeGreaterThan(55);
  });

  it("floors very low raw scores at 20 (no grade E)", () => {
    expect(patientDisplayClarity(0)).toBe(PATIENT_DISPLAY_SCORE_FLOOR);
    expect(patientDisplayClarity(5)).toBe(PATIENT_DISPLAY_SCORE_FLOOR);
    expect(patientClarityToGrade(0)).toBe("D");
    expect(patientClarityToGrade(15)).toBe("D");
  });
});

describe("patientUnlockedDisplayScore", () => {
  it("floors unlocked display below 20", () => {
    expect(patientUnlockedDisplayScore(0)).toBe(20);
    expect(patientUnlockedDisplayScore(12)).toBe(20);
    expect(patientUnlockedDisplayScore(72)).toBe(72);
  });
});

describe("patientGradeFromDisplayScore", () => {
  it("never returns A or E for patients", () => {
    expect(patientGradeFromDisplayScore(85)).toBe("B");
    expect(patientGradeFromDisplayScore(19)).toBe("D");
    expect(patientGradeFromDisplayScore(0)).toBe("D");
    for (let s = 0; s <= 100; s++) {
      const g = patientGradeFromDisplayScore(s);
      expect(g).not.toBe("A");
      expect(g).not.toBe("E");
    }
  });
});

describe("clarityToGrade", () => {
  it("maps display clarity bands A-E", () => {
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
    expect(patientClarityToGrade(100)).toBe("B");
    for (let r = 0; r <= 100; r++) {
      expect(patientClarityToGrade(r)).not.toBe("A");
      expect(patientClarityToGrade(r)).not.toBe("E");
    }
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
    expect(classifySkinParamMetric(15).grade).toBe("D");
    expect(classifySkinParamMetric(15).displayScore).toBeGreaterThanOrEqual(20);
    expect(classifySkinParamMetric(85).sublabel).toBe(gradeSublabel("B"));
  });
});

describe("patientScoreView", () => {
  it("shows letter grade when locked", () => {
    const locked = patientScoreView(72, false);
    expect(locked.locked).toBe(true);
    expect(locked.label).toBe(patientGradeWithRange(72));
    expect(locked.label).toBe("B");
  });

  it("shows capped display score when unlocked", () => {
    const unlocked = patientScoreView(72, true);
    expect(unlocked.locked).toBe(false);
    expect(unlocked.label).toBe(String(patientUnlockedDisplayScore(72)));
    const high = patientScoreView(79, true);
    expect(Number(high.label)).toBeLessThanOrEqual(79);
    expect(high.label).not.toBe("100");
  });
});

describe("patientKaiScoreView", () => {
  it("locks kAI with letter grade hint", () => {
    const locked = patientKaiScoreView(72, false);
    expect(locked.showLock).toBe(true);
    expect(locked.kaiPrimary).toBe("B");
    expect(locked.kaiSecondary).toBe("");
  });

  it("shows capped display score when unlocked", () => {
    const unlocked = patientKaiScoreView(72, true);
    expect(unlocked.showLock).toBe(false);
    expect(unlocked.kaiPrimary).toBe(String(patientUnlockedDisplayScore(72)));
    const high = patientKaiScoreView(79, true);
    expect(Number(high.kaiPrimary)).toBeLessThanOrEqual(79);
  });
});
