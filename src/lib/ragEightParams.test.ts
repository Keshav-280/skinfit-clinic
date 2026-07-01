import assert from "node:assert/strict";

import {
  RAG_KAI_PARAM_KEYS,
  RAG_KAI_PARAM_WEIGHTS,
  computeRagKaiScore,
} from "@/src/lib/ragEightParams";

function run() {
  const visibleWeightSum = RAG_KAI_PARAM_KEYS.reduce(
    (sum, key) => sum + RAG_KAI_PARAM_WEIGHTS[key],
    0
  );
  assert.equal(visibleWeightSum, 100);

  // Hidden keys must not affect patient kAI score.
  const withHidden = computeRagKaiScore({
    active_acne: 50,
    sagging_volume: 50,
    wrinkles: 50,
    acne_scar: 50,
    under_eye: 50,
    pigmentation: 50,
    hair_health: 0,
    skin_quality: 100,
  });
  const withoutHidden = computeRagKaiScore({
    active_acne: 50,
    sagging_volume: 50,
    wrinkles: 50,
    acne_scar: 50,
    under_eye: 50,
    pigmentation: 50,
  });
  assert.equal(withHidden, 50);
  assert.equal(withoutHidden, 50);

  // User-reported example: displayed categories → overall 66.
  assert.equal(
    computeRagKaiScore({
      active_acne: 69,
      sagging_volume: 73,
      wrinkles: 72,
      acne_scar: 77,
      under_eye: 79,
      pigmentation: 27,
    }),
    66
  );
}

run();
