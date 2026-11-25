import { describe, expect, it } from "vitest";
import { areasDippedTwice, decorateFocusRows, dippedTwiceInARow, plainWords, sayItAs } from "@/src/lib/report/movementWords";
import { applyCaptureToMovement, captureStateOf } from "@/src/lib/captureMeta";
import { validateGeneratedReport } from "@/src/lib/reportCopyGuard";

const pt = (...v: number[]) => v.map((value, i) => ({ at: new Date(2026, 0, i + 1), value }));

describe("movement wording is decided in code", () => {
  it("sizes the words: 3-4 a little, 5-9 clearly, 10+ a lot", () => {
    expect(sayItAs("improved", 3)).toMatch(/^a little/);
    expect(sayItAs("improved", 8)).toMatch(/^clearly/);
    expect(sayItAs("improved", 12)).toMatch(/^a lot/);
    expect(sayItAs("declined", -8)).toMatch(/^dipped/);
    expect(sayItAs("holding", 0)).toMatch(/^steady/);
  });

  it("uses patient names and never the internal ones", () => {
    const [r] = decorateFocusRows([{ key: "pigmentation", movement: "improved", change_points: 8 }]);
    expect(r.plain_name).toBe("dark spots and uneven tone");
    expect(plainWords("Pigmentation and active acne have moved")).toBe("dark spots and breakouts have moved");
  });

  it("finds an area that dipped on two reports in a row", () => {
    expect(dippedTwiceInARow(pt(74, 66, 58))).toBe(true);
    expect(dippedTwiceInARow(pt(74, 66, 65))).toBe(false);
    expect(dippedTwiceInARow(pt(74, 66))).toBe(false);
    expect(areasDippedTwice({ active_acne: pt(74, 66, 58), wrinkles: pt(70, 71, 72) })).toEqual(["active_acne"]);
  });
});

describe("poor light removes every claim of movement", () => {
  const meta = { occlusions: [], photos: [{ pose: "centre", lighting: "too_dark" as const, framing: "good" as const, checked: true }] };
  it("is degraded, and every area becomes tracking with no previous score", () => {
    expect(captureStateOf(meta)).toBe("degraded");
    const rows = applyCaptureToMovement([{ movement: "declined", change_points: -6, previous_score_100: 63 }], "degraded");
    expect(rows[0]).toMatchObject({ movement: "tracking", change_points: null, previous_score_100: null });
    expect(captureStateOf(undefined)).toBe("comparable");
  });
});

describe("the code checks facts from the data", () => {
  const sentence = "Your skin looks settled this week and we will compare again on your next scan.";
  it("wants the beard mentioned", () => {
    const payload = { capture_quality: { occlusions: ["beard"], photos: [] } };
    expect(validateGeneratedReport({ summary: sentence }, payload).join("|")).toContain("beard");
    expect(validateGeneratedReport({ summary: `${sentence} Your beard covers part of your jaw, so we left that area out.` }, payload).join("|")).not.toContain("beard");
  });
  it("wants poor light mentioned", () => {
    expect(validateGeneratedReport({ summary: sentence }, { capture_state: "degraded" }).join("|")).toContain("light or angle");
  });
  it("allows the check-in only once when there is none", () => {
    const twice = { summary: `${sentence} A weekly check-in is optional.`, week_recap: { highlight: "A weekly check-in helps us personalise your report." } };
    expect(validateGeneratedReport(twice, { weekly_checkin: null }).join("|")).toContain("more than once");
    expect(validateGeneratedReport({ summary: `${sentence} A weekly check-in is optional.` }, { weekly_checkin: null }).join("|")).not.toContain("more than once");
  });
  it("demands escalation and an in-person visit after two dips", () => {
    const payload = { dipped_two_reports_in_a_row: ["active_acne"] };
    const bad = validateGeneratedReport({ summary: sentence, escalate: false }, payload).join("|");
    expect(bad).toContain("escalate must be true");
    expect(bad).toContain("in person");
    const good = validateGeneratedReport({ summary: `${sentence} We suggest meeting your doctor in person.`, escalate: true }, payload).join("|");
    expect(good).not.toContain("escalate");
    expect(good).not.toContain("in person");
  });
});
