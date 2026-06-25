import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acquireImageLock,
  applyUserSync,
  mergedLabelsForExport,
  deleteShapeFromUser,
  mergeShapesWhenServerNewer,
  parseCollaborationStore,
  peerShapes,
  tombstoneSetForUser,
} from "./annotatorCollaboration";
import { isAnnotatorAdminEmail } from "./annotatorAdmins";

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

  it("does not clear existing shapes when an empty list arrives without allowEmpty", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [{ id: "a1", imageIndex: 0, category: "Active Acne", spec: "", severity: "A", color: "red", type: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
    });
    assert.equal(store.perUserShapes["user-a"]?.length, 1);

    // Stray empty save (e.g. bad load) must not wipe saved shapes.
    store = applyUserSync(store, "user-a", { annotations: [] });
    assert.equal(store.perUserShapes["user-a"]?.length, 1);
  });

  it("clears shapes on empty list only when allowEmptyAnnotations is set", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [{ id: "a1", imageIndex: 0, category: "Active Acne", spec: "", severity: "A", color: "red", type: "path", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }],
    });
    store = applyUserSync(store, "user-a", { annotations: [], allowEmptyAnnotations: true });
    assert.equal(store.perUserShapes["user-a"]?.length, 0);
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

  it("deletes a shape from another user's bucket", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [
        {
          id: "a1",
          imageIndex: 0,
          category: "Active Acne",
          spec: "",
          severity: "A",
          color: "red",
          type: "path",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        {
          id: "a2",
          imageIndex: 0,
          category: "Pigmentation",
          spec: "",
          severity: "B",
          color: "blue",
          type: "line",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    });
    store = deleteShapeFromUser(store, "user-a", "a1");
    assert.equal(store.perUserShapes["user-a"]?.length, 1);
    assert.equal(store.perUserShapes["user-a"]?.[0]?.id, "a2");
  });

  it("blocks stale client restore after admin delete via tombstones", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [
        {
          id: "a1",
          imageIndex: 0,
          category: "Active Acne",
          spec: "",
          severity: "A",
          color: "red",
          type: "path",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    });
    store = { ...store, userSyncAt: { ...store.userSyncAt, "user-a": "2025-06-01T00:00:00.000Z" } };

    store = deleteShapeFromUser(store, "user-a", "a1", "2025-06-02T00:00:00.000Z");
    assert.equal(store.perUserShapes["user-a"]?.length, 0);
    assert.equal(tombstoneSetForUser(store, "user-a").has("a1"), true);

    // Stale tab tries to restore a1 on autosave
    store = applyUserSync(
      store,
      "user-a",
      {
        annotations: [
          {
            id: "a1",
            imageIndex: 0,
            category: "Active Acne",
            spec: "",
            severity: "A",
            color: "red",
            type: "path",
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        clientSyncedAt: "2025-06-01T00:00:00.000Z",
      },
      "2025-06-02T00:00:01.000Z"
    );
    assert.equal(store.perUserShapes["user-a"]?.length, 0);
  });

  it("allows new shapes after admin delete when client sync is stale", () => {
    let store = parseCollaborationStore(null);
    store = applyUserSync(store, "user-a", {
      annotations: [
        {
          id: "a1",
          imageIndex: 0,
          category: "Active Acne",
          spec: "",
          severity: "A",
          color: "red",
          type: "path",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    });
    store = { ...store, userSyncAt: { ...store.userSyncAt, "user-a": "2025-06-01T00:00:00.000Z" } };
    store = deleteShapeFromUser(store, "user-a", "a1", "2025-06-02T00:00:00.000Z");

    store = applyUserSync(
      store,
      "user-a",
      {
        annotations: [
          {
            id: "a2",
            imageIndex: 0,
            category: "Pigmentation",
            spec: "",
            severity: "B",
            color: "blue",
            type: "line",
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
        clientSyncedAt: "2025-06-01T00:00:00.000Z",
      },
      "2025-06-02T00:00:05.000Z"
    );
    assert.equal(store.perUserShapes["user-a"]?.length, 1);
    assert.equal(store.perUserShapes["user-a"]?.[0]?.id, "a2");
  });
});

describe("annotatorAdmins", () => {
  it("recognises configured admin emails case-insensitively", () => {
    assert.equal(isAnnotatorAdminEmail("prabhu@ambaforlife.org"), true);
    assert.equal(isAnnotatorAdminEmail("prabhu.m@ambaforlife.org"), true);
    assert.equal(isAnnotatorAdminEmail("soujanya.c@ambaforlife.org"), true);
    assert.equal(isAnnotatorAdminEmail("shushma.p@ambaforlife.org"), true);
    assert.equal(isAnnotatorAdminEmail("  Prabhu@AmbaForLife.org "), true);
    assert.equal(isAnnotatorAdminEmail("not-an-admin@example.com"), false);
  });
});
