import { describe, expect, it } from "vitest";
import { buildReportContent, pickObservations, proseProblems } from "@/src/lib/medixora/content";
import { readMedixoraData } from "@/src/lib/medixora/report";

const report = (age = "44") =>
  readMedixoraData({
    Score: "60",
    LevelName: "ORPW",
    Customer: { Age: age, Sex: "female", Name: "Asha", Count: "2" },
    ResultDetail: [
      ["Acne", 77], ["Pores", 42], ["Wrinkle", 20], ["Sebum", 45], ["Brown pigment", 49],
    ].map(([Name, Score]) => ({ Name, Score, FaceType: "2" })),
  });

const good = {
  skinTypeSummary: "Your skin may feel oily by afternoon and marks can linger.",
  commentaries: Array(3).fill("This area is doing well today. Keeping a gentle routine helps protect it."),
  insight:
    "Oil and pores often move together. Cleanse gently each evening. Wear sunscreen every morning this week. Your calm skin is a good base to build on.",
};

describe("styled Medixora report", () => {
  it("shows the strongest area first, then the two lowest", () => {
    expect(pickObservations(report()).map((m) => m.label)).toEqual(["Acne", "Wrinkle", "Pores"]);
    expect(pickObservations(report("24")).map((m) => m.label)).toEqual(["Acne", "Pores", "Sebum"]);
  });

  it("accepts clean writing and rejects medical names, digits and wrong lengths", () => {
    expect(proseProblems(good)).toEqual([]);
    const bad = proseProblems({ ...good, insight: "Try retinol for 2 weeks." }).join(" ");
    expect(bad).toContain("retinol");
    expect(bad).toContain("digits");
    expect(bad).toContain("4 to 5");
  });

  it("takes every number from the machine and never sends the name to the writer", async () => {
    let sent = "";
    const { content, hasProse } = await buildReportContent(report(), async (data) => {
      sent = JSON.stringify(data);
      return good;
    });
    expect(hasProse).toBe(true);
    expect(content.kaiScore).toBe(60);
    expect(content.observations.map((o) => [o.score, o.color])).toEqual([[77, "green"], [20, "red"], [42, "amber"]]);
    expect(content.skinTypePlain).toContain("Oily");
    expect(sent).not.toContain("Asha");
  });

  it("makes the report without sentences, not with stock ones, when writing fails", async () => {
    const { content, hasProse } = await buildReportContent(report(), async () => ({
      skinTypeSummary: "", commentaries: [], insight: "",
    }));
    expect(hasProse).toBe(false);
    expect(content.observations.every((o) => o.commentary === "")).toBe(true);
    expect(content.insight).toBe("");
  });
});
