import { describe, expect, it } from "vitest";
import {
  filterConsumerEvidence,
  isCleanCopy,
  validateGeneratedReport,
} from "@/src/lib/reportCopyGuard";

const payload = { current_scan: { grades: [{ key: "pigmentation", score_100: 61 }] } };

describe("validateGeneratedReport", () => {
  it("accepts a clean report", () => {
    const report = {
      status: "published",
      summary: "Your pigmentation is 61/100 on this baseline. We will track it each week.",
      actions: [{ parameter: "pigmentation", title: "Protect tone with morning SPF", detail: "Pigmentation is 61/100. Apply sunscreen each morning this week." }],
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
