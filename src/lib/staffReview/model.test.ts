import { describe, expect, it } from "vitest";
import {
  kaiScoreFromScanRow,
  ragParamValuesFromScanRow,
} from "@/src/lib/resolveScanDisplayScores";
import { staffScanFromPending } from "@/src/lib/staffReview/build";
import {
  comparableScans,
  readSixScores,
  readStaffReview,
  sanitizeShapes,
} from "@/src/lib/staffReview/model";

const scores = { active_acne: 98, acne_scar: 41, pigmentation: 7, under_eye: 100, wrinkles: 63, sagging_volume: 55 };
const pending = {
  scanValues: {
    userId: "u", imageUrl: "/x.jpg", overallScore: 33, acne: 33, pigmentation: 33, wrinkles: 33, hydration: 33, texture: 33,
    aiSummary: "model sentence",
    annotations: [{ x: 1 }],
    scores: { modelFeatureScores: { active_acne: 5 }, detection_regions: [1], overlayUrl: "/o.jpg", scanOrdinal: 1, captureMeta: { occlusions: [] } },
  },
  paramRows: {},
  skinScan: { originalImageUrl: "/x.jpg", annotatedImageUrl: "/o.jpg", skinScore: 33, analysisResults: {} },
};
const built = () =>
  staffScanFromPending(pending as never, { scores, note: "n", shapes: [], reviewer: "r", reviewedAt: "now" }, { centre: "/m.jpg" });

describe("staff scoring", () => {
  it("shows the staff numbers exactly, with no curve or early-scan limit, and averages them", () => {
    const v = built().scanValues;
    const row = { ...v, hydration: v.hydration!, texture: v.texture!, scores: { ...(v.scores as object), scanOrdinal: 1 } } as never;
    expect(ragParamValuesFromScanRow(row)).toEqual(scores);
    expect(kaiScoreFromScanRow(row)).toBe(61);
    expect(v.overallScore).toBe(61);
  });

  it("leaves every model result out of the patient's scan", () => {
    const text = JSON.stringify(built());
    for (const gone of ["model sentence", "modelFeatureScores", "detection_regions", "/o.jpg"]) {
      expect(text, gone).not.toContain(gone);
    }
    expect(text).toContain("captureMeta");
  });

  it("needs all six scores between 1 and 100", () => {
    expect(readSixScores({ ...scores, wrinkles: 0 })).toEqual({ missing: ["Wrinkles"] });
    expect(readSixScores({ ...scores, under_eye: 101, pigmentation: null })).toEqual({ missing: ["Pigmentation", "Under-eye"] });
  });

  it("accepts the marking tool's shapes and drops broken ones", () => {
    const out = sanitizeShapes([
      { view: "left", param: "acne_scars", type: "circle", cx: 0.5, cy: 0.5, r: 0.02 },
      { view: "top", param: "wrinkles", type: "line", x1: 0, y1: 0, x2: 1, y2: 1 },
      { view: "front", param: "made_up", type: "circle", cx: 0.5, cy: 0.5, r: 0.02 },
      { view: "front", param: "wrinkles", type: "line", x1: 0, y1: 0, x2: "<svg>", y2: 1 },
    ]);
    expect(out).toEqual([{ view: "left", area: "acne_scar", type: "circle", cx: 0.5, cy: 0.5, r: 0.02 }]);
  });

  it("never compares a staff-scored scan with an old model-scored one", () => {
    const staff = { scores: built().scanValues.scores };
    const old = { scores: { modelFeatureScores: {} } };
    expect(readStaffReview(staff.scores)?.overall).toBe(61);
    expect(comparableScans(staff.scores, [old, staff])).toEqual([staff]);
    expect(comparableScans(old.scores, [old, staff])).toEqual([old, staff]);
  });
});
