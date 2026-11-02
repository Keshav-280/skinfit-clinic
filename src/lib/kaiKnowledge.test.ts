import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatKaiReferences, retrieveKaiReferences } from "@/src/lib/kaiKnowledge";

const labels = (q: string, recent?: string) =>
  retrieveKaiReferences({ message: q, recentUserText: recent }).map((r) => r.label.toLowerCase());

describe("retrieveKaiReferences", () => {
  it("finds material for real skin questions", () => {
    expect(labels("What helps with pimples on my chin?").some((l) => l.includes("acne"))).toBe(true);
    expect(labels("What is melasma and will it come back?").some((l) => l.includes("melasma"))).toBe(true);
    expect(labels("How long does microneedling take to work for scars?").some((l) => l.includes("microneedling"))).toBe(true);
    expect(labels("Can stress make my skin worse?").length).toBeGreaterThan(0);
  });

  it("pulls nothing for chit-chat and off-topic questions", () => {
    for (const q of ["hi", "thanks, that helps", "what is the capital of France", "ok"]) {
      expect(retrieveKaiReferences({ message: q })).toEqual([]);
    }
  });

  it("answers questions about the patient's own results from their report, not articles", () => {
    expect(retrieveKaiReferences({ message: "What does my acne score mean?" })).toEqual([]);
    expect(retrieveKaiReferences({ message: "Explain my latest report" })).toEqual([]);
  });

  it("lets a short follow-up borrow the previous question", () => {
    expect(retrieveKaiReferences({ message: "how long does it take?" })).toEqual([]);
    expect(
      retrieveKaiReferences({ message: "how long does it take?", recentUserText: "tell me about microneedling for scars" }).length
    ).toBeGreaterThan(0);
  });

  it("returns short plain labels with no IDs or links", () => {
    const refs = retrieveKaiReferences({ message: "Is niacinamide good for oily skin?" });
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(r.label).not.toMatch(/PMC\d|https?:|\[CC/);
      expect(r.text.length).toBeLessThanOrEqual(760);
    }
  });
});

describe("formatKaiReferences", () => {
  it("is empty without references and tells the model how to use them otherwise", () => {
    expect(formatKaiReferences([])).toBe("");
    const out = formatKaiReferences(retrieveKaiReferences({ message: "melasma treatment" }));
    expect(out).toContain("Reference material");
    expect(out).toContain("ignore it");
  });
});
