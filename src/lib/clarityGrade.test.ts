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
  it("lets a very good scan reach the top of the 0-90 range", () => {
    expect(patientDisplayClarity(100)).toBe(90);
    expect(patientClarityToGrade(100)).toBe("A");
    expect(patientDisplayClarity(97)).toBeGreaterThanOrEqual(87);
    expect(patientDisplayClarity(97)).toBeLessThan(90);
  });

  it("preserves sensitivity in mid range", () => {
    expect(patientDisplayClarity(40)).toBeGreaterThan(30);
    expect(patientDisplayClarity(40)).toBeLessThan(50);
    expect(patientDisplayClarity(60)).toBeGreaterThan(55);
  });

  it("keeps responding to small real changes at the top end", () => {
    // Previously raw 80 → 76 and raw 100 → 79, so +5 raw moved the number by about 1.
    for (const raw of [55, 65, 75, 85]) {
      expect(patientDisplayClarity(raw + 5) - patientDisplayClarity(raw)).toBeGreaterThanOrEqual(2);
    }
    expect(patientDisplayClarity(90) - patientDisplayClarity(80)).toBeGreaterThanOrEqual(4);
  });

  it("is strictly increasing across the whole range", () => {
    let prev = patientDisplayClarity(0);
    for (let r = 1; r <= 100; r++) {
      const cur = patientDisplayClarity(r);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
    expect(patientDisplayClarity(100)).toBe(90);
  });

  it("is unchanged at and below the knee", () => {
    expect(patientDisplayClarity(30)).toBe(27);
    expect(patientDisplayClarity(40)).toBe(42);
    expect(patientDisplayClarity(50)).toBe(55);
  });

  it("lets a clearly bad scan reach 0 (grade E)", () => {
    expect(PATIENT_DISPLAY_SCORE_FLOOR).toBe(0);
    expect(patientDisplayClarity(0)).toBe(0);
    expect(patientClarityToGrade(0)).toBe("E");
    expect(patientClarityToGrade(15)).toBe("E");
  });
});

describe("patientUnlockedDisplayScore", () => {
  it("clamps unlocked display to 0-90", () => {
    expect(patientUnlockedDisplayScore(0)).toBe(0);
    expect(patientUnlockedDisplayScore(12)).toBe(12);
    expect(patientUnlockedDisplayScore(72)).toBe(72);
    expect(patientUnlockedDisplayScore(100)).toBe(90);
  });
});

describe("patientGradeFromDisplayScore", () => {
  it("uses the full A-E range", () => {
    expect(patientGradeFromDisplayScore(85)).toBe("A");
    expect(patientGradeFromDisplayScore(70)).toBe("B");
    expect(patientGradeFromDisplayScore(19)).toBe("E");
    expect(patientGradeFromDisplayScore(0)).toBe("E");
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
  it("maps raw scores across the full A-E range", () => {
    expect(patientClarityToGrade(100)).toBe("A");
    expect(patientClarityToGrade(70)).toBe("B");
    expect(patientClarityToGrade(40)).toBe("C");
    expect(patientClarityToGrade(0)).toBe("E");
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
    expect(high.grade).toBe("A");
    expect(high.displayScore).toBeLessThanOrEqual(90);
    expect(classifySkinParamMetric(15).grade).toBe("E");
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
    const high = patientScoreView(100, true);
    expect(Number(high.label)).toBeLessThanOrEqual(90);
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
    const high = patientKaiScoreView(100, true);
    expect(Number(high.kaiPrimary)).toBeLessThanOrEqual(90);
  });
});
