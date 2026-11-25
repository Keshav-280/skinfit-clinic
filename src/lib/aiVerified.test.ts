import { describe, expect, it, vi } from "vitest";
import { aiReview, feedbackBrief, quoteIsReal, runVerified } from "@/src/lib/aiVerified";

const pass = async () => ({ pass: true, issues: [] as string[] });

describe("runVerified (write -> AI check -> code check)", () => {
  it("returns the first draft that passes all layers", async () => {
    const generate = vi.fn(async () => "good");
    const out = await runVerified({ name: "t", generate, review: pass, codeCheck: () => [] });
    expect(out).toBe("good");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("rewrites from scratch, with the reasons, when the AI checker rejects", async () => {
    const seen: Array<string[] | null> = [];
    const generate = vi.fn(async (fb: string[] | null) => {
      seen.push(fb);
      return seen.length === 1 ? "bad" : "good";
    });
    const review = vi.fn(async (c: string) =>
      c === "good" ? { pass: true, issues: [] } : { pass: false, issues: ["names a condition"] }
    );
    const out = await runVerified({ name: "t", generate, review, codeCheck: () => [] });
    expect(out).toBe("good");
    expect(seen).toEqual([null, ["names a condition"]]);
  });

  it("rewrites when the code layer finds a problem even if the AI checker passes", async () => {
    let n = 0;
    const generate = async () => (++n === 1 ? "score 95/100" : "score 82/100");
    const out = await runVerified({
      name: "t",
      generate,
      review: pass,
      codeCheck: (c) => (c.includes("95") ? ["number not in the data"] : []),
    });
    expect(out).toBe("score 82/100");
    expect(n).toBe(2);
  });

  it("shows nothing (null) after the maximum attempts, never a fallback", async () => {
    const generate = vi.fn(async () => "always bad");
    const out = await runVerified({
      name: "t",
      maxAttempts: 3,
      generate,
      review: async () => ({ pass: false, issues: ["still wrong"] }),
      codeCheck: () => [],
    });
    expect(out).toBeNull();
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("treats an empty generation as a failed attempt and tries again", async () => {
    let n = 0;
    const out = await runVerified({
      name: "t",
      generate: async () => (++n < 2 ? null : "ok"),
      review: pass,
      codeCheck: () => [],
    });
    expect(out).toBe("ok");
  });
});

describe("the AI checker fails closed", () => {
  it("rejects when the checker cannot run (no API key)", async () => {
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const r = await aiReview({ kind: "x", data: {}, candidate: "hello" });
      expect(r.pass).toBe(false);
      expect(r.issues.join(" ")).toMatch(/unavailable|failed/);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});

describe("feedbackBrief", () => {
  it("lists every problem for the writer", () => {
    const brief = feedbackBrief(["a", "b"]);
    expect(brief).toContain("- a");
    expect(brief).toContain("- b");
    expect(brief).toContain("again from scratch");
  });
});

describe("checker issues must quote real words", () => {
  const cand = { summary: "Your pimples look calmer this week.", next_step: { label: "Book an in-person visit" } };
  it("accepts a quote that is in the text and rejects an invented one", () => {
    expect(quoteIsReal(cand, "Your pimples look calmer")).toBe(true);
    expect(quoteIsReal(cand, "The headline contains a digit")).toBe(false);
    expect(quoteIsReal(cand, "")).toBe(false);
  });
});

describe("a draft with only tone points is published when nothing cleaner arrives", () => {
  it("falls back to the best soft draft", async () => {
    const out = await runVerified({
      name: "soft",
      maxAttempts: 2,
      generate: async () => "stiff but safe",
      review: async () => ({ pass: false, issues: ["Rule 8: tone"], soft: true }),
      codeCheck: () => [],
    });
    expect(out).toBe("stiff but safe");
  });
  it("never publishes a draft with a code problem", async () => {
    const out = await runVerified({
      name: "soft2",
      maxAttempts: 2,
      generate: async () => "bad",
      review: async () => ({ pass: false, issues: ["Rule 8: tone"], soft: true }),
      codeCheck: () => ["number not in the data"],
    });
    expect(out).toBeNull();
  });
});
