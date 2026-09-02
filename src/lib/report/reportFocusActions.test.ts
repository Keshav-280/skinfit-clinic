import { describe, expect, it } from "vitest";

import {
  coalesceFocusActions,
  parseLlmFocusActions,
  splitActionText,
} from "./reportFocusActions";
import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";

function row(
  key: KaiReportParamRow["key"],
  name: string,
  score10: number
): KaiReportParamRow {
  return {
    key,
    name,
    shortName: name,
    severity: 5 - score10 / 2,
    clarity: score10 * 10,
    grade: String(score10),
    score10,
    gradeColor: "mid",
    finding: "",
    concernChipId: null,
  };
}

describe("splitActionText", () => {
  it("does not repeat a one-sentence action as the body", () => {
    const split = splitActionText(
      "Continue maintaining a high-protein diet."
    );
    expect(split.title.toLowerCase()).toContain("high-protein");
    expect(split.detail).toBe("");
  });

  it("keeps a distinct second sentence as the how", () => {
    const split = splitActionText(
      "Shield pigment at 9am. SPF then, and a 1pm reapply on outdoor days."
    );
    expect(split.title.toLowerCase()).toContain("pigment");
    expect(split.detail.toLowerCase()).toContain("spf");
    expect(split.detail.toLowerCase()).not.toBe(split.title.toLowerCase());
  });
});

describe("parseLlmFocusActions", () => {
  it("drops duplicate titles and the same parameter twice", () => {
    const parsed = parseLlmFocusActions([
      { title: "Calm new breakouts", detail: "Acne is 5/10. Use a cream cleanser.", parameter: "active_acne" },
      { title: "Calm new breakouts", detail: "Something else", parameter: "wrinkles" },
      { title: "Protect pigment", detail: "Pigment is 6/10. SPF at 9am.", parameter: "active_acne" },
      { title: "Sleep for under-eyes", detail: "Under eye is 4/10. Keep a 11pm bedtime.", parameter: "under_eye" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((a) => a.parameter)).toEqual(["active_acne", "under_eye"]);
  });
});

describe("coalesceFocusActions", () => {
  it("fills to three unique parameter steps from scores", () => {
    const actions = coalesceFocusActions({
      llmActions: [
        {
          title: "Calm new breakouts",
          detail: "Active acne is 4/10. You logged eating outside - keep one gentle night step.",
          parameter: "active_acne",
        },
      ],
      rows: [
        row("active_acne", "Active Acne", 4),
        row("pigmentation", "Pigmentation", 6),
        row("wrinkles", "Wrinkles", 7),
      ],
      wellness: {
        nutritionLevel: "Eating Outside",
        exerciseHours: "2-4",
        sleepHours: "6-8",
        supplements: null,
        stressLevel: 6,
        city: "Bengaluru",
        skincareRoutine: ["Cleanser", "Sunscreen"],
        activeIngredients: null,
        weekYmd: "2026-08-31",
        water: "6-8",
      },
    });
    expect(actions).toHaveLength(3);
    expect(new Set(actions.map((a) => a.title)).size).toBe(3);
    for (const a of actions) {
      expect(a.detail.toLowerCase()).not.toBe(a.title.toLowerCase());
      expect(a.detail.length).toBeGreaterThan(a.title.length);
    }
  });
});
