import { describe, expect, it } from "vitest";

import {
  computeLifestyleAlignmentScore,
  isYmdInWeek,
  mondayYmdOf,
  weeksOnApp,
} from "./lifestyleAlignmentScore";

describe("mondayYmdOf", () => {
  it("returns the Monday of the given calendar week", () => {
    expect(mondayYmdOf("2026-09-02")).toBe("2026-08-31");
    expect(mondayYmdOf("2026-08-31")).toBe("2026-08-31");
    expect(mondayYmdOf("2026-09-06")).toBe("2026-08-31");
  });
});

describe("isYmdInWeek", () => {
  it("includes Monday through today", () => {
    expect(isYmdInWeek("2026-08-31", "2026-08-31", "2026-09-02")).toBe(true);
    expect(isYmdInWeek("2026-09-02", "2026-08-31", "2026-09-02")).toBe(true);
    expect(isYmdInWeek("2026-08-30", "2026-08-31", "2026-09-02")).toBe(false);
  });
});

describe("weeksOnApp", () => {
  it("counts the start week as week 1", () => {
    expect(weeksOnApp("2026-09-02", "2026-09-02")).toBe(1);
    expect(weeksOnApp("2026-08-31", "2026-09-06")).toBe(1);
  });

  it("counts later Mondays as extra weeks", () => {
    expect(weeksOnApp("2026-08-31", "2026-09-07")).toBe(2);
    expect(weeksOnApp("2026-08-31", "2026-09-21")).toBe(4);
  });
});

describe("computeLifestyleAlignmentScore", () => {
  it("is 100 after one scan and one questionnaire in week 1", () => {
    expect(
      computeLifestyleAlignmentScore({
        weeksOnApp: 1,
        scanCount: 1,
        questionnaireCount: 1,
      })
    ).toBe(100);
  });

  it("is 50 with only a scan in week 1", () => {
    expect(
      computeLifestyleAlignmentScore({
        weeksOnApp: 1,
        scanCount: 1,
        questionnaireCount: 0,
      })
    ).toBe(50);
  });

  it("drops when weeks pass without matching scans and questionnaires", () => {
    expect(
      computeLifestyleAlignmentScore({
        weeksOnApp: 4,
        scanCount: 1,
        questionnaireCount: 1,
      })
    ).toBe(25);
  });

  it("caps at 100 even with extra scans", () => {
    expect(
      computeLifestyleAlignmentScore({
        weeksOnApp: 2,
        scanCount: 8,
        questionnaireCount: 2,
      })
    ).toBe(100);
  });
});
