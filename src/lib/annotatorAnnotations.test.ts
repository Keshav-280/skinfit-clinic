import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pruneAnnotations,
  remapAnnotationsByFileName,
  reconcileAnnotationsForImageSet,
} from "./annotatorAnnotations";
import { severityGradeToScore } from "./annotatorSeverityGrade";

describe("annotatorSeverityGrade", () => {
  it("maps A→1 and E→5", () => {
    assert.equal(severityGradeToScore("A"), 1);
    assert.equal(severityGradeToScore("E"), 5);
  });
});

describe("annotatorAnnotations", () => {
  const base = {
    id: "ann-1",
    imageIndex: 0,
    category: "Under-Eye",
    spec: "Puffiness",
    severity: "B" as const,
    color: "blue",
    type: "path" as const,
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.2, y: 0.3 },
      { x: 0.3, y: 0.2 },
    ],
  };

  it("prunes out-of-range indices", () => {
    const out = pruneAnnotations([{ ...base, imageIndex: 3 }], 2);
    assert.equal(out.length, 0);
  });

  it("remaps by fileName when order changes", () => {
    const prevMeta = [{ name: "a.png" }, { name: "b.png" }];
    const nextMeta = [{ name: "b.png" }, { name: "a.png" }];
    const remapped = remapAnnotationsByFileName(
      [{ ...base, imageIndex: 0 }],
      prevMeta,
      nextMeta,
      2
    );
    assert.equal(remapped[0]?.imageIndex, 1);
  });

  it("reconcile combines remap and prune", () => {
    const reconciled = reconcileAnnotationsForImageSet(
      [{ ...base, imageIndex: 0 }, { ...base, id: "ann-2", imageIndex: 5 }],
      [{ name: "a.png" }],
      [{ name: "a.png" }]
    );
    assert.equal(reconciled.length, 1);
    assert.equal(reconciled[0]?.imageIndex, 0);
  });
});
