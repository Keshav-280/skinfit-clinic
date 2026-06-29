import { describe, expect, it } from "vitest";

import {
  clarityGradeTrendPhrase,
  clarityRawTrendPhrase,
  softenPatientText,
  trendSummary,
} from "./weeklyInsightFormat";

describe("clarityRawTrendPhrase", () => {
  it("treats lower clarity as worse (29 vs 35)", () => {
    expect(clarityRawTrendPhrase(35, 29)).toMatch(/slipped|little/);
    expect(clarityRawTrendPhrase(29, 35)).toMatch(/improv|slightly/);
  });
});

describe("clarityGradeTrendPhrase", () => {
  it("knows A is better than E", () => {
    expect(clarityGradeTrendPhrase("D", "C")).toBe("improved from grade D to C");
    expect(clarityGradeTrendPhrase("C", "D")).toBe("slipped from grade C to D");
    expect(clarityGradeTrendPhrase("D", "D")).toBe("held around grade D");
  });
});

describe("softenPatientText when locked", () => {
  it("rewrites inverted improvement claims", () => {
    const out = softenPatientText(
      "Active acne improved from 35 to 29 this week.",
      false
    );
    expect(out).not.toMatch(/\b35\b|\b29\b/);
    expect(out.toLowerCase()).toMatch(/slipped|little|grade/);
  });

  it("strips leaked numeric scores", () => {
    const out = softenPatientText("Your kAI score of 72 held steady.", false);
    expect(out).not.toMatch(/\b72\b/);
  });

  it("rewrites awkward grade comparisons", () => {
    const out = softenPatientText(
      "Active acne is grade D, which is worse than grade C.",
      false
    );
    expect(out.toLowerCase()).not.toContain("worse than grade");
  });
});

describe("softenPatientText when unlocked", () => {
  it("fixes inverted numeric comparisons", () => {
    const out = softenPatientText(
      "Active acne is 29, which is better than 35.",
      true
    );
    expect(out.toLowerCase()).not.toContain("better than 35");
    expect(out.toLowerCase()).toMatch(/slipped|little|worse/);
  });

  it("fixes inverted grade comparisons", () => {
    const out = softenPatientText(
      "Active acne slipped to grade D, which is better than grade C.",
      true
    );
    expect(out.toLowerCase()).toContain("slipped from grade c to d");
  });
});

describe("trendSummary", () => {
  it("uses softer labels when scores are locked", () => {
    expect(trendSummary(-4, false).label).toBe("Needs a closer look");
    expect(trendSummary(4, false).label).toBe("Moving up");
    expect(trendSummary(4, true).label).toBe("Improving");
  });

  it("maps positive delta to improving when unlocked", () => {
    expect(trendSummary(5, true).tone).toBe("up");
    expect(trendSummary(-5, true).tone).toBe("down");
  });
});
