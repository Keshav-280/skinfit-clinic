import assert from "node:assert/strict";

import { resolveScanDisplayScores } from "@/src/lib/resolveScanDisplayScores";

function makeBaseMetrics() {
  return {
    overallScore: 10,
    acne: 75,
    wrinkles: 25,
    pigmentation: 75,
    hydration: 60,
    texture: 55,
  };
}

function run() {
  // severity 1–5 values (modelFeatureScores scale).
  const modelFeatureScores = {
    active_acne: 2, // -> 75 clarity
    acne_scars: 3, // -> 50 clarity
    wrinkle_severity: 4, // -> 25 clarity
    sagging_volume: 1, // -> 100 clarity
    under_eye: 5, // -> 0 clarity
    pigmentation_model: 2, // -> 75 clarity

    // Hidden keys (still present in model JSON)
    skin_quality: 3,
    hair_health: 4,
    wrinkle_cls_severity: 3,
    wrinkle_seg_severity: 3,
  };

  // Case 1: no doctor overrides → computed kAI score.
  {
    const res = resolveScanDisplayScores({
      scoresJson: { modelFeatureScores },
      baseMetricsColumns: makeBaseMetrics(),
    });

    // Expected weighted average (see ragEightParams weights).
    // active_acne 75 * 16
    // sagging_volume 100 * 12
    // wrinkles 25 * 14
    // acne_scar 50 * 12
    // under_eye 0 * 10
    // pigmentation 75 * 12
    // sum = 4250, sumW = 76 → 55.92 → round 56
    assert.equal(res.metrics.overall_score, 56);
    assert.equal(res.metrics.clinical_scores?.active_acne, 2);
    assert.equal(res.metrics.clinical_scores?.wrinkle_severity, 4);
  }

  // Case 2: doctor override merges into clinical scores + uses kaiScore override.
  {
    const res = resolveScanDisplayScores({
      scoresJson: {
        modelFeatureScores,
        doctorOverrides: {
          kaiScore: 72,
          modelFeatureScores: {
            active_acne: 5, // -> 0 clarity
            wrinkle_severity: 1, // -> 100 clarity
            pigmentation_model: 1, // -> 100 clarity
          },
        },
      },
      baseMetricsColumns: makeBaseMetrics(),
    });

    assert.equal(res.metrics.overall_score, 72);
    assert.equal(res.metrics.clinical_scores?.active_acne, 5);
    assert.equal(res.metrics.clinical_scores?.wrinkle_severity, 1);
    assert.equal(res.resolvedRagParamValues.active_acne, 0);
  }

  // Case 3: doctor override without modelFeatureScores keeps clinical values from base model.
  {
    const res = resolveScanDisplayScores({
      scoresJson: {
        modelFeatureScores,
        doctorOverrides: { kaiScore: 33 },
      },
      baseMetricsColumns: makeBaseMetrics(),
    });

    assert.equal(res.metrics.overall_score, 33);
    assert.equal(res.metrics.clinical_scores?.active_acne, 2);
  }
}

run();

