import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rebalanceAssignmentRanges,
  ownerUserIdForImageIndex,
  imageIndexInAssignment,
} from "./annotatorAssignments";

describe("annotator parallel assignments", () => {
  it("splits 10 images across 3 annotators", () => {
    const ranges = rebalanceAssignmentRanges(["u1", "u2", "u3"], 10);
    assert.equal(ranges.length, 3);
    assert.deepEqual(
      ranges.map((r) => r.endIndex - r.startIndex + 1),
      [4, 3, 3]
    );
    assert.equal(ranges[0]?.startIndex, 0);
    assert.equal(ranges[2]?.endIndex, 9);
  });

  it("maps image index to owner", () => {
    const ranges = rebalanceAssignmentRanges(["a", "b"], 4);
    assert.equal(ownerUserIdForImageIndex(0, ranges), "a");
    assert.equal(ownerUserIdForImageIndex(3, ranges), "b");
  });

  it("allows all indices when assignment is null", () => {
    assert.equal(imageIndexInAssignment(5, null), true);
  });
});
