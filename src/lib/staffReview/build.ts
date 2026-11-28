/**
 * Builds the scan the patient receives from the held analysis and the staff review. The model's
 * scores, markings, masks and sentence are left behind (they stay in the review record only).
 */
import type { PendingScan } from "@/src/lib/scanReview/publish";
import {
  averageScore,
  type PhotoView,
  type StaffReview,
  type StaffScores,
} from "@/src/lib/staffReview/model";

/** Pose names used by stored photos. */
export const POSE_OF_VIEW: Record<PhotoView, "centre" | "left" | "right"> = {
  front: "centre",
  left: "left",
  right: "right",
};

export function staffScanFromPending(
  pending: PendingScan,
  review: Omit<StaffReview, "version" | "overall">,
  markedByPose: Record<string, string>
): PendingScan {
  const s: StaffScores = review.scores;
  const overall = averageScore(s);
  const staffReview: StaffReview = { version: 1, overall, ...review };
  const original = (pending.scanValues.scores ?? {}) as Record<string, unknown>;
  const value = (v: number) => ({ value: v, source: "doctor" });

  const scores = {
    staffReview,
    overallKaiScore: overall,
    kaiParams: {
      active_acne: value(s.active_acne),
      acne_scars: value(s.acne_scar),
      pigmentation: value(s.pigmentation),
      under_eye: value(s.under_eye),
      wrinkles: value(s.wrinkles),
      sagging_volume: value(s.sagging_volume),
    },
    // The same override shape the doctor score editor uses, so older readers agree.
    doctorOverrides: { kaiScore: overall, parameterScores: { ...s }, patientDisplayScale: 2 },
    ...(original.captureMeta ? { captureMeta: original.captureMeta } : {}),
    ...(Object.keys(markedByPose).length ? { spotAnnotatedByPose: markedByPose } : {}),
    ...(markedByPose.centre ? { spotAnnotatedUrl: markedByPose.centre } : {}),
  };

  const columns = {
    overallScore: overall,
    acne: s.active_acne,
    pigmentation: s.pigmentation,
    wrinkles: s.wrinkles,
    hydration: s.under_eye,
    texture: s.acne_scar,
  };
  const row = (v: number) => ({ value: v, source: "doctor" as const });

  return {
    scanValues: {
      ...pending.scanValues,
      ...columns,
      aiSummary: null,
      annotations: [],
      scores: scores as unknown as PendingScan["scanValues"]["scores"],
    },
    paramRows: {
      acne_pimples: row(s.active_acne),
      acne_scars: row(s.acne_scar),
      pigmentation: row(s.pigmentation),
      wrinkles: row(s.wrinkles),
    },
    skinScan: {
      originalImageUrl: pending.skinScan.originalImageUrl,
      annotatedImageUrl: markedByPose.centre ?? pending.skinScan.originalImageUrl,
      skinScore: overall,
      analysisResults: {
        ...scores,
        acne: s.active_acne,
        pigmentation: s.pigmentation,
        wrinkles: s.wrinkles,
        hydration: s.under_eye,
        texture: s.acne_scar,
        kaiOverallScore: overall,
      },
    },
  };
}
