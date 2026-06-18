import assert from "node:assert/strict";

import {
  cosineSimilarity,
  faceIdentityMatchThreshold,
} from "@/src/lib/faceIdentityInference";

function run() {
  const a = [1, 0, 0];
  const b = [1, 0, 0];
  const c = [0, 1, 0];
  assert.ok(cosineSimilarity(a, b) > 0.99);
  assert.ok(cosineSimilarity(a, c) < 0.01);
  const threshold = faceIdentityMatchThreshold();
  assert.ok(threshold >= 0.2 && threshold <= 0.95);
  console.log("faceIdentityInference tests ok");
}

run();
