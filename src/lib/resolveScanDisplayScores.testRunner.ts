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
    // under_eye from hydration column (60), acne_scar from texture column (55).
    // sum = 4910, sumW = 76 → 64.6 → round 65
    assert.equal(res.metrics.overall_score, 65);
    assert.equal(res.metrics.clinical_scores?.active_acne, 2);
    assert.equal(res.metrics.clinical_scores?.wrinkle_severity, 4);
  }

  // Case 2: doctor param overrides via modelFeatureScores — kAI follows weighted params.
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

    // Weighted from overridden severities + hydration/texture columns: 67 (not stale kaiScore: 72).
    assert.equal(res.metrics.overall_score, 67);
    assert.equal(res.metrics.clinical_scores?.active_acne, 5);
    assert.equal(res.metrics.clinical_scores?.wrinkle_severity, 1);
    assert.equal(res.resolvedRagParamValues.active_acne, 0);
  }

  // Case 3: legacy kaiScore-only override (no param changes) is preserved.
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

  // Case 4: direct parameterScores overrides recompute kAI from weighted sum.
  {
    const res = resolveScanDisplayScores({
      scoresJson: {
        modelFeatureScores,
        doctorOverrides: {
          kaiScore: 99,
          parameterScores: {
            active_acne: 25,
            sagging_volume: 77,
            wrinkles: 76,
            acne_scar: 100,
            under_eye: 100,
            pigmentation: 100,
          },
        },
      },
      baseMetricsColumns: makeBaseMetrics(),
    });

    assert.equal(res.metrics.overall_score, 76);
    assert.equal(res.resolvedRagParamValues.active_acne, 25);
    assert.equal(res.resolvedRagParamValues.sagging_volume, 77);
  }
}

run();

