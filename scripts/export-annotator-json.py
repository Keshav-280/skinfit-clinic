#!/usr/bin/env python3
"""
Export annotator JSON from Postgres (same merged data as web Export button).
No npm/npx needed — uses docker exec into postgres.

Usage on EC2:
  cd /opt/skinfit
  python3 scripts/export-annotator-json.py ~/skinnfit-export.json

Or download to Mac:
  scp -i skinfit-key.pem ubuntu@13.234.166.154:~/skinnfit-export.json ~/Desktop/
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any

POSTGRES_CONTAINER = "docker-postgres-1"
PG_USER = "skinfit"
PG_DB = "skinfit"

ALL_CATEGORIES = [
    "Active Acne",
    "Acne Scars",
    "Pigmentation",
    "Wrinkles",
    "Sagging & Volume",
    "Under-Eye",
]

GRADE_SCORE = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5}


def psql_json(query: str) -> Any:
    cmd = [
        "docker",
        "exec",
        POSTGRES_CONTAINER,
        "psql",
        "-U",
        PG_USER,
        "-d",
        PG_DB,
        "-t",
        "-A",
        "-c",
        query,
    ]
    raw = subprocess.check_output(cmd, text=True).strip()
    if not raw or raw == "null":
        return None
    return json.loads(raw)


def normalize_grade(v: Any) -> str:
    if isinstance(v, str) and v in GRADE_SCORE:
        return v
    if isinstance(v, (int, float)) and 1 <= int(v) <= 5:
        return ["A", "B", "C", "D", "E"][int(v) - 1]
    return "A"


def grade_to_score(grade: str) -> int:
    return GRADE_SCORE.get(grade, 1)


def merged_labels_for_export(
    per_user_labels: dict, per_user_shapes: dict, user_sync_at: dict
) -> dict[str, dict[str, dict]]:
    image_indices: set[str] = set()
    for labels in (per_user_labels or {}).values():
        if isinstance(labels, dict):
            image_indices.update(labels.keys())

    out: dict[str, dict[str, dict]] = {}
    for image_key in image_indices:
        best_user = None
        best_ts = 0
        for user_id, labels in (per_user_labels or {}).items():
            if not isinstance(labels, dict) or image_key not in labels:
                continue
            ts = 0
            try:
                from datetime import datetime

                ts = int(
                    datetime.fromisoformat(
                        (user_sync_at or {}).get(user_id, "").replace("Z", "+00:00")
                    ).timestamp()
                    * 1000
                ) if (user_sync_at or {}).get(user_id) else 0
            except Exception:
                ts = 0
            shapes = (per_user_shapes or {}).get(user_id) or []
            has_shapes = any(str(s.get("imageIndex")) == image_key for s in shapes if isinstance(s, dict))
            score = ts + (1 if has_shapes else 0)
            if score >= best_ts:
                best_ts = score
                best_user = user_id
        if best_user:
            out[image_key] = dict((per_user_labels or {}).get(best_user, {}).get(image_key, {}))
    return out


def all_shapes_merged(per_user_shapes: dict) -> list[dict]:
    out: list[dict] = []
    for user_id, shapes in (per_user_shapes or {}).items():
        if not isinstance(shapes, list):
            continue
        for shape in shapes:
            if not isinstance(shape, dict):
                continue
            ann = dict(shape)
            ann["userId"] = user_id
            points = ann.get("points") or []
            min_pts = 2 if ann.get("type") == "line" else 3
            if len(points) >= min_pts:
                out.append(ann)
    return out


def main() -> None:
    out_path = (
        sys.argv[1]
        if len(sys.argv) > 1
        else f"skinnfit-annotations-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S')}.json"
    )

    state = psql_json(
        "SELECT row_to_json(t) FROM ("
        " SELECT per_user_labels, per_user_shapes, user_sync_at "
        " FROM annotator_state WHERE scope = 'default' LIMIT 1"
        ") t;"
    )
    if not state:
        print("No annotator_state row found", file=sys.stderr)
        sys.exit(1)

    images_rows = psql_json(
        "SELECT coalesce(json_agg(row_to_json(t) ORDER BY sort_order, id), '[]'::json) FROM ("
        " SELECT file_name AS \"fileName\", sort_order AS \"sortOrder\", id "
        " FROM annotator_images ORDER BY sort_order, id"
        ") t;"
    )
    images_rows = images_rows or []

    per_user_labels = state.get("per_user_labels") or {}
    per_user_shapes = state.get("per_user_shapes") or {}
    user_sync_at = state.get("user_sync_at") or {}

    merged_labels = merged_labels_for_export(per_user_labels, per_user_shapes, user_sync_at)
    annotations = []
    for ann in all_shapes_merged(per_user_shapes):
        severity = normalize_grade(ann.get("severity"))
        annotations.append({**ann, "severity": severity, "score": grade_to_score(severity)})

    labels_by_image_index: dict[str, dict] = {}
    for i in range(len(images_rows)):
        merged = {c: {"spec": "", "grade": "A", "score": 1} for c in ALL_CATEGORIES}
        patch = merged_labels.get(str(i)) or {}
        for c in ALL_CATEGORIES:
            entry = patch.get(c) if isinstance(patch, dict) else None
            if isinstance(entry, dict):
                grade = normalize_grade(entry.get("grade") or entry.get("score"))
                merged[c] = {
                    "spec": entry.get("spec") or "",
                    "grade": grade,
                    "score": grade_to_score(grade),
                }
        labels_by_image_index[str(i)] = merged

    payload = {
        "schemaVersion": 2,
        "app": "skinnfit-clinical-annotator",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "note": (
            "Images are not embedded. Match `images[].fileName` to files on disk. "
            "Points are normalized 0–1 vs image width/height. `grade` is A–E (A=least severe); "
            "`score` is numeric 1–5 for eval pipelines. Merged export includes all collaborators' shapes and labels."
        ),
        "imageCount": len(images_rows),
        "images": [
            {
                "index": i,
                "fileName": row.get("fileName") or f"image-{i + 1}",
                "imageWidth": None,
                "imageHeight": None,
            }
            for i, row in enumerate(images_rows)
        ],
        "labelsByImageIndex": labels_by_image_index,
        "annotations": annotations,
    }

    text = json.dumps(payload, indent=2)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    mb = len(text) / 1024 / 1024
    print(
        f"Exported {len(annotations)} annotations, {len(images_rows)} images → {out_path} ({mb:.2f} MB)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
