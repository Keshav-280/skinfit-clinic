#!/usr/bin/env python3
"""
Restore annotator JSON export into Postgres annotator_state (per_user_shapes + per_user_labels).

Does NOT touch annotator_images or R2 files. Backs up current state before overwrite.

Usage on EC2:
  cd /opt/skinfit
  python3 scripts/restore-annotator-json.py ~/skinnfit-annotations-2026-06-25T17-38-50.json

Dry run (parse + counts only):
  python3 scripts/restore-annotator-json.py export.json --dry-run

Skip interactive confirm:
  python3 scripts/restore-annotator-json.py export.json --yes
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

POSTGRES_CONTAINER = "docker-postgres-1"
PG_USER = "skinfit"
PG_DB = "skinfit"
SCOPE = "default"

ALL_CATEGORIES = [
    "Active Acne",
    "Acne Scars",
    "Pigmentation",
    "Wrinkles",
    "Sagging & Volume",
    "Under-Eye",
]

SHAPE_FIELDS = frozenset(
    {"id", "imageIndex", "category", "spec", "severity", "color", "type", "points"}
)


def psql_scalar(query: str) -> str:
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
    return subprocess.check_output(cmd, text=True).strip()


def psql_json(query: str) -> Any:
    raw = psql_scalar(query)
    if not raw or raw == "null":
        return None
    return json.loads(raw)


def psql_exec(query: str) -> None:
    cmd = [
        "docker",
        "exec",
        POSTGRES_CONTAINER,
        "psql",
        "-U",
        PG_USER,
        "-d",
        PG_DB,
        "-c",
        query,
    ]
    subprocess.check_call(cmd)


def count_shapes_in_db() -> int:
    raw = psql_scalar(
        "SELECT coalesce(sum(jsonb_array_length(value)), 0)::int "
        "FROM annotator_state, jsonb_each(per_user_shapes) "
        f"WHERE scope = '{SCOPE}';"
    )
    return int(raw or 0)


def db_image_file_names() -> list[str]:
    rows = psql_json(
        "SELECT coalesce(json_agg(file_name ORDER BY sort_order, id), '[]'::json) "
        "FROM annotator_images;"
    )
    return rows or []


def clean_shape(ann: dict[str, Any]) -> dict[str, Any] | None:
    shape = {k: ann[k] for k in SHAPE_FIELDS if k in ann}
    points = shape.get("points") or []
    min_pts = 2 if shape.get("type") == "line" else 3
    if len(points) < min_pts:
        return None
    if "imageIndex" not in shape or "id" not in shape:
        return None
    return shape


def clean_label_entry(entry: Any) -> dict[str, str]:
    if not isinstance(entry, dict):
        return {"spec": "", "grade": "A"}
    grade = entry.get("grade") or "A"
    if isinstance(grade, (int, float)) and 1 <= int(grade) <= 5:
        grade = ["A", "B", "C", "D", "E"][int(grade) - 1]
    if grade not in {"A", "B", "C", "D", "E"}:
        grade = "A"
    return {"spec": entry.get("spec") or "", "grade": grade}


def labels_are_default(labels: dict[str, Any]) -> bool:
    for cat in ALL_CATEGORIES:
        entry = labels.get(cat)
        if not isinstance(entry, dict):
            continue
        cleaned = clean_label_entry(entry)
        if cleaned["spec"] or cleaned["grade"] != "A":
            return False
    return True


def build_index_remap(
    export_images: list[dict[str, Any]], db_names: list[str]
) -> dict[int, int]:
    db_index_by_name = {name: i for i, name in enumerate(db_names)}
    remap: dict[int, int] = {}
    for img in export_images:
        export_idx = img.get("index")
        file_name = img.get("fileName")
        if export_idx is None or not file_name:
            continue
        if file_name in db_index_by_name:
            remap[int(export_idx)] = db_index_by_name[file_name]
        elif int(export_idx) < len(db_names):
            remap[int(export_idx)] = int(export_idx)
    return remap


def restore_from_export(
    payload: dict[str, Any], db_names: list[str]
) -> tuple[dict[str, list], dict[str, dict], dict[str, str], dict[str, int]]:
    export_images = payload.get("images") or []
    annotations = payload.get("annotations") or []
    labels_by_image = payload.get("labelsByImageIndex") or {}
    exported_at = payload.get("exportedAt") or datetime.now(timezone.utc).isoformat()

    index_remap = build_index_remap(export_images, db_names)
    image_count = len(db_names)

    per_user_shapes: dict[str, list] = defaultdict(list)
    skipped_shapes = 0
    remapped_shapes = 0

    for ann in annotations:
        if not isinstance(ann, dict):
            skipped_shapes += 1
            continue
        user_id = ann.get("userId") or "__legacy__"
        shape = clean_shape(ann)
        if not shape:
            skipped_shapes += 1
            continue

        old_idx = int(shape["imageIndex"])
        new_idx = index_remap.get(old_idx)
        if new_idx is None:
            skipped_shapes += 1
            continue
        if new_idx != old_idx:
            remapped_shapes += 1
        if new_idx < 0 or new_idx >= image_count:
            skipped_shapes += 1
            continue

        shape["imageIndex"] = new_idx
        per_user_shapes[user_id].append(shape)

    shapes_per_user_image: dict[str, Counter] = defaultdict(Counter)
    for user_id, shapes in per_user_shapes.items():
        for shape in shapes:
            shapes_per_user_image[user_id][str(shape["imageIndex"])] += 1

    per_user_labels: dict[str, dict] = defaultdict(dict)
    labels_assigned = 0
    labels_skipped = 0

    for image_key, labels in labels_by_image.items():
        if not isinstance(labels, dict):
            continue
        try:
            export_idx = int(image_key)
        except (TypeError, ValueError):
            labels_skipped += 1
            continue
        db_idx = index_remap.get(export_idx)
        if db_idx is None or db_idx < 0 or db_idx >= image_count:
            labels_skipped += 1
            continue

        db_key = str(db_idx)
        cleaned = {
            cat: clean_label_entry(labels.get(cat))
            for cat in ALL_CATEGORIES
            if isinstance(labels.get(cat), dict) or cat in labels
        }
        if not cleaned:
            labels_skipped += 1
            continue

        primary_user: str | None = None
        best_count = 0
        for user_id, counts in shapes_per_user_image.items():
            count = counts.get(db_key, 0)
            if count > best_count:
                best_count = count
                primary_user = user_id

        if primary_user is None:
            if labels_are_default(cleaned):
                labels_skipped += 1
                continue
            primary_user = "__legacy__"

        sparse = {
            cat: entry
            for cat, entry in cleaned.items()
            if entry["spec"] or entry["grade"] != "A"
        }
        if sparse:
            per_user_labels[primary_user][db_key] = sparse
            labels_assigned += 1
        else:
            labels_skipped += 1

    user_sync_at = {
        user_id: exported_at
        for user_id in set(per_user_shapes.keys()) | set(per_user_labels.keys())
    }

    stats = {
        "annotations_in_export": len(annotations),
        "shapes_restored": sum(len(v) for v in per_user_shapes.values()),
        "skipped_shapes": skipped_shapes,
        "remapped_shapes": remapped_shapes,
        "users_with_shapes": len(per_user_shapes),
        "labels_assigned_images": labels_assigned,
        "labels_skipped_images": labels_skipped,
    }

    return dict(per_user_shapes), dict(per_user_labels), user_sync_at, stats


def backup_current_state() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    table = f"annotator_state_backup_{stamp}"
    psql_exec(
        f"CREATE TABLE {table} AS SELECT * FROM annotator_state WHERE scope = '{SCOPE}';"
    )
    return table


def apply_restore(
    per_user_shapes: dict[str, list],
    per_user_labels: dict[str, dict],
    user_sync_at: dict[str, str],
) -> None:
    shapes_json = json.dumps(per_user_shapes)
    labels_json = json.dumps(per_user_labels)
    sync_json = json.dumps(user_sync_at)
    sql = f"""
UPDATE annotator_state
SET
  per_user_shapes = $shapes${shapes_json}$shapes$::jsonb,
  per_user_labels = $labels${labels_json}$labels$::jsonb,
  user_sync_at = $sync${sync_json}$sync$::jsonb,
  shape_tombstones = '{{}}'::jsonb,
  updated_at = now()
WHERE scope = '{SCOPE}';
"""
    proc = subprocess.run(
        ["docker", "exec", "-i", POSTGRES_CONTAINER, "psql", "-U", PG_USER, "-d", PG_DB],
        input=sql,
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        print(proc.stdout, file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        raise RuntimeError("Failed to apply restore to annotator_state")


def main() -> None:
    parser = argparse.ArgumentParser(description="Restore annotator export JSON to Postgres")
    parser.add_argument("export_path", help="Path to skinnfit-annotations export JSON")
    parser.add_argument("--dry-run", action="store_true", help="Parse only; do not write DB")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup table creation (not recommended)",
    )
    args = parser.parse_args()

    with open(args.export_path, encoding="utf-8") as f:
        payload = json.load(f)

    print(f"Export exportedAt: {payload.get('exportedAt')}")
    print(f"Export images: {len(payload.get('images') or [])}")
    print(f"Export annotations: {len(payload.get('annotations') or [])}")

    db_names = db_image_file_names()
    if not db_names:
        print("No annotator_images rows found — aborting.", file=sys.stderr)
        sys.exit(1)

    before_count = count_shapes_in_db()
    print(f"Current DB annotation count: {before_count}")
    print(f"Current DB image count: {len(db_names)}")

    per_user_shapes, per_user_labels, user_sync_at, stats = restore_from_export(
        payload, db_names
    )

    print("Restore plan:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    print(f"  user buckets: {sorted(per_user_shapes.keys())}")

    if args.dry_run:
        print("Dry run — no database changes made.")
        return

    if not args.yes:
        answer = input(
            f"\nOverwrite annotator_state for scope={SCOPE}? "
            f"({before_count} -> {stats['shapes_restored']} shapes) [y/N]: "
        ).strip()
        if answer.lower() not in {"y", "yes"}:
            print("Aborted.")
            sys.exit(0)

    backup_table = None
    if not args.no_backup:
        backup_table = backup_current_state()
        print(f"Backup saved to table: {backup_table}")

    apply_restore(per_user_shapes, per_user_labels, user_sync_at)

    after_count = count_shapes_in_db()
    print(f"\nRestore complete.")
    print(f"  annotations before: {before_count}")
    print(f"  annotations after:  {after_count}")
    print(f"  export target:      {stats['shapes_restored']}")

    if after_count != stats["shapes_restored"]:
        print(
            "WARNING: after count does not match restored shape count "
            "(possible validation mismatch).",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
