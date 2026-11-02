import { describe, expect, it } from "vitest";

import { KAI_SYSTEM_PROMPT } from "@/src/lib/kaiPersona";

describe("kAI persona prompt", () => {
  it("never carries internal business material from the reference guide", () => {
    for (const banned of [
      "WhatsApp", "Meta", "Curology", "Gangnam", "Unni", "lululab", "Shiseido", "Miiskin",
      "Akhil", "Gino", "Keshav", "call script", "win-back", "opt-in", "Dr. Mili",
    ]) {
      expect(KAI_SYSTEM_PROMPT).not.toContain(banned);
    }
  });

  it("makes kAI understand first and always leave one next step", () => {
    expect(KAI_SYSTEM_PROMPT).toContain("Understand first, then help");
    expect(KAI_SYSTEM_PROMPT).toContain("ONE focused question");
    expect(KAI_SYSTEM_PROMPT).toContain("EVERY reply ends with exactly one engaging next step");
    expect(KAI_SYSTEM_PROMPT).toContain("never ask two questions");
  });

  it("keeps the safety rules", () => {
    expect(KAI_SYSTEM_PROMPT).toContain("must not diagnose");
    expect(KAI_SYSTEM_PROMPT).toContain("isotretinoin");
    expect(KAI_SYSTEM_PROMPT).toContain("urgent medical care");
    expect(KAI_SYSTEM_PROMPT).toContain("headset icon");
  });

  it("uses the guide's wording rules", () => {
    expect(KAI_SYSTEM_PROMPT).toContain("Scan. Score. Update. Chat.");
    expect(KAI_SYSTEM_PROMPT).toContain("Never describe the app as \"tracking\"");
  });
});
