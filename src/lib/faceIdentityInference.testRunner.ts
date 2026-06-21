import assert from "node:assert/strict";

import {
  cosineSimilarity,
  faceIdentityMatchThreshold,
  faceIdentityMatchThresholdForLabel,
  faceIdentityProfileMatchThreshold,
} from "@/src/lib/faceIdentityInference";

function run() {
  const a = [1, 0, 0];
  const b = [1, 0, 0];
  const c = [0, 1, 0];
  assert.ok(cosineSimilarity(a, b) > 0.99);
  assert.ok(cosineSimilarity(a, c) < 0.01);
  const threshold = faceIdentityMatchThreshold();
  assert.ok(threshold >= 0.2 && threshold <= 0.95);
  const profileThreshold = faceIdentityProfileMatchThreshold();
  assert.ok(profileThreshold >= 0.2 && profileThreshold <= 0.95);
  assert.ok(profileThreshold <= threshold);
  assert.equal(faceIdentityMatchThresholdForLabel("centre"), threshold);
  assert.equal(faceIdentityMatchThresholdForLabel("left"), profileThreshold);
  console.log("faceIdentityInference tests ok");
}

run();
