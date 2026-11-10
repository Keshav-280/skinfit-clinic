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
  const goodSummary =
    "Hi Priya. You came to us for dark spots, so we looked there first. Your skin starts at 61 out of 100 overall, with firmness and fine lines in good shape and dark spots with the most room to fade. Since you told us your skin is combination, keep your routine light. This is your starting point, and skin changes slowly, so next week's scan shows how it moves.";

  it("accepts a clean report", () => {
    const report = {
      status: "published",
      summary: goodSummary,
      parameters: [{ key: "pigmentation", label: "Pigmentation", finding: "Some dark spots show right now, so this is your area to focus on." }],
      actions: [
        { parameter: "pigmentation", title: "Put sunscreen on before you step out", detail: "Your dark spots are at 61 out of 100, and sun can keep them darker. Apply sunscreen before you leave and again after lunch." },
        { parameter: "under_eye", title: "Keep a regular bedtime most nights", detail: "Tired eyes tend to look darker. Aim for 6 to 8 hours of sleep this week." },
        { parameter: "wrinkles", title: "Cleanse gently twice a day", detail: "A mild cleanse and a light moisturiser keep your skin comfortable." },
      ],
    };
    expect(validateGeneratedReport(report, payload)).toEqual([]);
  });

  it("rejects medicines, invented scores, letter grades, cut-off text and exclamations", () => {
    const bad = {
      summary: "Great skin! Dark spots are 95/100 and a grade B result. Use tretinoin at night and",
    };
    const issues = validateGeneratedReport(bad, payload).join(" | ");
    expect(issues).toContain("medical advice term");
    expect(issues).toContain("95/100");
    expect(issues).toContain("letter grade");
    expect(issues).toContain("exclamation");
    expect(issues).toContain("unfinished sentence");
  });

  it("allows up to two numbers in the summary, from the data, and no more", () => {
    const three = goodSummary.replace("firmness", "firmness (61, 61 and 61)");
    expect(validateGeneratedReport({ summary: three }, payload).join(" | ")).toContain("more than two numbers");
    const invented = goodSummary.replace("61 out of 100", "73 out of 100");
    expect(validateGeneratedReport({ summary: invented }, payload).join(" | ")).toContain("not in the data");
  });

  it("allows habit numbers and the area score in an action detail, but no digits in findings or the headline", () => {
    const ok = { actions: [{ parameter: "pigmentation", title: "Protect your tone", detail: "Aim for 6 to 8 hours of sleep. Your dark spots are at 61 out of 100." }] };
    expect(validateGeneratedReport(ok, payload).filter((i) => i.includes("numbers in"))).toEqual([]);
    expect(validateGeneratedReport({ parameters: [{ finding: "Your dark spots are at 61 right now." }] }, payload).join(" | ")).toContain("numbers in finding");
    expect(validateGeneratedReport({ overall: { headline: "Up 5 points this week" } }, payload).join(" | ")).toContain("numbers in headline");
  });

  it("rejects internal words, filler words and long headlines or summaries", () => {
    const i1 = validateGeneratedReport({ parameters: [{ finding: "Your pigmentation looks lovely and really even." }] }, payload).join(" | ");
    expect(i1).toContain("internal word");
    expect(i1).toContain("filler word");
    expect(validateGeneratedReport({ overall: { headline: "one two three four five six seven eight nine ten eleven twelve thirteen" } }, payload).join(" | ")).toContain("headline is longer");
    expect(validateGeneratedReport({ summary: "Short summary." }, payload).join(" | ")).toContain("summary is");
  });

  it("wants exactly 3 actions and at most 3 parameter notes", () => {
    const one = { actions: [{ parameter: "a", title: "t", detail: "A short sentence here." }] };
    expect(validateGeneratedReport(one, payload).join(" | ")).toContain("exactly 3 actions");
    const four = { parameters: [{}, {}, {}, {}] };
    expect(validateGeneratedReport(four, payload).join(" | ")).toContain("at most 3 parameter notes");
    expect(validateGeneratedReport({ status: "recapture_required", actions: [] }, payload)).toEqual([]);
  });

  it("rejects a named doctor in the report", () => {
    const issues = validateGeneratedReport({ next_step: { label: "Message your doctor about it", reason: "Dr. Ruby can look at this with you." } }, payload).join(" | ");
    expect(issues).toContain("names a doctor");
  });

  it("allows digits only in the share card line", () => {
    expect(validateGeneratedReport({ share_card: { score_100: 62, line: "Week 6 - acne improving" } }, payload)).toEqual([]);
  });

  it("ignores label fields such as status and movement, and the check-in figures", () => {
    expect(validateGeneratedReport({ status: "published", movement: "improved" }, payload)).toEqual([]);
    expect(validateGeneratedReport({ week_recap: { sleep: "6-8 hrs", stress: "Mixed", water: "-" } }, payload)).toEqual([]);
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
