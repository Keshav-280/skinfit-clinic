import { describe, expect, it } from "vitest";
import { displayCapForScores } from "@/src/lib/clarityGrade";
import {
  filterConsumerEvidence,
  isCleanCopy,
  validateGeneratedReport,
} from "@/src/lib/reportCopyGuard";

const payload = { current_scan: { grades: [{ key: "pigmentation", score_100: 61 }] } };

describe("early-scan display cap", () => {
  it("before a clinic visit: 80 for scans 1-3, then +2 per scan, never above 85", () => {
    const caps = [1, 2, 3, 4, 5, 6, 7, 8, 20].map((n) => displayCapForScores({ scanOrdinal: n }));
    expect(caps).toEqual([80, 80, 80, 82, 84, 85, 85, 85, 85]);
  });

  it("after a clinic visit the ramp continues to 90", () => {
    const caps = [3, 4, 5, 6, 7, 8, 20].map((n) =>
      displayCapForScores({ scanOrdinal: n, displayUnlocked: true })
    );
    expect(caps).toEqual([80, 82, 84, 86, 88, 90, 90]);
  });

  it("scans without a stamp use the locked ceiling", () => {
    expect(displayCapForScores({})).toBe(85);
    expect(displayCapForScores(null)).toBe(85);
    expect(displayCapForScores({ displayUnlocked: true })).toBe(90);
  });
});

describe("validateGeneratedReport", () => {
  it("accepts a clean report", () => {
    const report = {
      status: "published",
      summary: "Your pigmentation looks settled on this first read. We will keep an eye on it each week.",
      actions: [{ parameter: "pigmentation", title: "Protect tone with morning SPF", detail: "Your tone looks even, so protect it. Apply sunscreen each morning this week." }],
    };
    expect(validateGeneratedReport(report, payload)).toEqual([]);
  });

  it("rejects medicines, invented scores, letter grades, cut-off text and exclamations", () => {
    const bad = {
      summary: "Great skin! Pigmentation is 95/100 and a grade B result. Use tretinoin at night and",
    };
    const issues = validateGeneratedReport(bad, payload).join(" | ");
    expect(issues).toContain("medical advice term");
    expect(issues).toContain("95/100");
    expect(issues).toContain("letter grade");
    expect(issues).toContain("exclamation");
    expect(issues).toContain("unfinished sentence");
  });

  it("rejects any digit in report sentences (the screen already shows the numbers)", () => {
    const issues = validateGeneratedReport(
      { summary: "Your skin slept well, about six to eight hours, and scored 82 this time." },
      payload
    ).join(" | ");
    expect(issues).toContain("numbers in summary");
  });

  it("allows digits only in the share card line", () => {
    expect(validateGeneratedReport({ share_card: { score_100: 62, line: "Week 6 - acne improving" } }, payload)).toEqual([]);
  });

  it("ignores label fields such as status and movement", () => {
    expect(validateGeneratedReport({ status: "published", movement: "improved" }, payload)).toEqual([]);
  });
});

describe("isCleanCopy and filterConsumerEvidence", () => {
  it("rejects cut-off and rare-disease text", () => {
    expect(isCleanCopy("5, and ATAP7A lead to in various types. Corneal involvement is classical of de Barsy syndrome")).toBe(false);
    expect(isCleanCopy("A calm, regular routine helps most. Keep it simple this week.")).toBe(true);
  });

  it("drops rare-disease chunks", () => {
    const chunk = (text: string) => ({ chunk: { text } as never, score: 1 });
    const out = filterConsumerEvidence([chunk("de Barsy syndrome and cutis laxa"), chunk("Daily sunscreen helps even tone")]);
    expect(out).toHaveLength(1);
  });
});
