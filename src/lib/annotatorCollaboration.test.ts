import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acquireImageLock,
  applyUserSync,
  mergedLabelsForExport,
  parseCollaborationStore,
  peerShapes,
} from "./annotatorCollaboration";

describe("annotatorCollaboration", () => {
  it("migrates legacy monolithic state", () => {
    const store = parseCollaborationStore({
      annotations: [{ id: "a1", imageIndex: 0, category: "Active Acne", spec: "x", severity: "A", color: "red", type: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
      perImageByCategory: { "0": { "Active Acne": { grade: "B" } } },
    });
    assert.equal(store.perUserShapes.__legacy__?.length, 1);
    assert.equal(store.perUserLabels.__legacy__?.["0"]?.["Active Acne"]?.grade, "B");
  });

  it("stores per-user shapes without overwriting peers", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [{ id: "a1", imageIndex: 0, category: "Active Acne", spec: "x", severity: "A", color: "red", type: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
    });
    store = applyUserSync(store, "user-b", {
      annotations: [{ id: "b1", imageIndex: 1, category: "Wrinkles", spec: "y", severity: "C", color: "blue", type: "line", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    });
    assert.equal(store.perUserShapes["user-a"]?.length, 1);
    assert.equal(store.perUserShapes["user-b"]?.length, 1);
    assert.equal(peerShapes(store, "user-a").length, 1);
  });

  it("blocks lock when another user holds it", () => {
    const store = parseCollaborationStore(null);
    const first = acquireImageLock(store, 3, { id: "u1", name: "Alice" });
    const second = acquireImageLock(first.store, 3, { id: "u2", name: "Bob" });
    assert.equal(second.conflict?.userId, "u1");
  });

  it("merges export labels from latest editor", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "u1", {
      perImageByCategory: { "0": { "Active Acne": { grade: "B", spec: "Papules" } } },
    });
    store = { ...store, userSyncAt: { ...store.userSyncAt, u1: "2020-01-01T00:00:00.000Z" } };
    store = applyUserSync(store, "u2", {
      perImageByCategory: { "0": { "Active Acne": { grade: "D", spec: "Papules" } } },
    });
    store = { ...store, userSyncAt: { ...store.userSyncAt, u2: "2025-01-01T00:00:00.000Z" } };
    const merged = mergedLabelsForExport(store);
    assert.equal(merged["0"]?.["Active Acne"]?.grade, "D");
  });
});
