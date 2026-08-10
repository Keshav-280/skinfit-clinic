#!/usr/bin/env node
/**
 * Convert a SkinFit annotator export (schemaVersion 2) into a YOLO detection
 * dataset for the multi-class skin detector.
 *
 * The annotator stores polygons/lines with points normalized 0–1 against image
 * width/height. YOLO wants `class cx cy w h`, also normalized — so the polygon
 * bounding box converts directly with no image reads required.
 *
 * Usage:
 *   node scripts/annotator-to-yolo.mjs \
 *     --input skinnfit-annotations-2026-08-10.json \
 *     --images ./raw-images \
 *     --out ./datasets/skin-detector \
 *     [--val 0.2] [--min-box 0.004] [--seed 42] [--dry]
 *
 * `--images` is the folder holding the files named by `images[].fileName`.
 * Images are copied into the split dirs; pass --dry to only print the report.
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

/** Annotator category → YOLO class. Order defines the class index. */
const CLASS_ORDER = [
  "active_acne",
  "acne_scars",
  "pigmentation",
  "under_eye",
];

const CATEGORY_TO_CLASS = {
  "Active Acne": "active_acne",
  "Acne Scars": "acne_scars",
  Pigmentation: "pigmentation",
  "Under-Eye": "under_eye",
};

// Score-only in the annotator (no drawable regions) — skipped, not an error.
const SCORE_ONLY = new Set(["Wrinkles", "Sagging & Volume"]);

function parseArgs(argv) {
  const args = {
    val: 0.2,
    minBox: 0.004,
    seed: 42,
    dry: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--input") args.input = next();
    else if (a === "--images") args.images = next();
    else if (a === "--out") args.out = next();
    else if (a === "--val") args.val = Number(next());
    else if (a === "--min-box") args.minBox = Number(next());
    else if (a === "--seed") args.seed = Number(next());
    else if (a === "--dry") args.dry = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

/** Deterministic per-image split so re-runs keep the same train/val partition. */
function hashUnit(str, seed) {
  const h = createHash("sha1").update(`${seed}:${str}`).digest();
  return ((h[0] << 16) | (h[1] << 8) | h[2]) / 0xffffff;
}

function bboxFromPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxY)) return null;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  minX = clamp01(minX);
  minY = clamp01(minY);
  maxX = clamp01(maxX);
  maxY = clamp01(maxY);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;
  return { cx: minX + w / 2, cy: minY + h / 2, w, h };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    console.log(
      "Usage: node scripts/annotator-to-yolo.mjs --input <export.json> " +
        "--images <dir> --out <dir> [--val 0.2] [--min-box 0.004] [--dry]"
    );
    process.exit(args.help ? 0 : 1);
  }

  const payload = JSON.parse(readFileSync(resolve(args.input), "utf8"));
  const images = Array.isArray(payload.images) ? payload.images : [];
  const annotations = Array.isArray(payload.annotations) ? payload.annotations : [];

  if (images.length === 0) {
    console.error("No images in export — nothing to convert.");
    process.exit(1);
  }

  // ── group boxes by image ──────────────────────────────────────────
  const boxesByImage = new Map();
  const perClassCount = Object.fromEntries(CLASS_ORDER.map((c) => [c, 0]));
  const skipped = { scoreOnly: 0, unknownCategory: 0, tooSmall: 0, badPoints: 0 };
  const unknownCategories = new Set();

  for (const ann of annotations) {
    const category = ann?.category;
    if (SCORE_ONLY.has(category)) {
      skipped.scoreOnly += 1;
      continue;
    }
    const cls = CATEGORY_TO_CLASS[category];
    if (!cls) {
      skipped.unknownCategory += 1;
      if (category) unknownCategories.add(String(category));
      continue;
    }
    const points = Array.isArray(ann.points) ? ann.points : [];
    if (points.length < 2) {
      skipped.badPoints += 1;
      continue;
    }
    const box = bboxFromPoints(points);
    if (!box) {
      skipped.badPoints += 1;
      continue;
    }
    // A line (e.g. a thin scar) has ~zero height — give it a floor so the box
    // is trainable rather than degenerate.
    const w = Math.max(box.w, args.minBox);
    const h = Math.max(box.h, args.minBox);
    if (w < args.minBox || h < args.minBox) {
      skipped.tooSmall += 1;
      continue;
    }
    const idx = Number(ann.imageIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= images.length) continue;
    if (!boxesByImage.has(idx)) boxesByImage.set(idx, []);
    boxesByImage.get(idx).push({
      cls,
      classIndex: CLASS_ORDER.indexOf(cls),
      cx: box.cx,
      cy: box.cy,
      w,
      h,
    });
    perClassCount[cls] += 1;
  }

  // ── report ────────────────────────────────────────────────────────
  const labeledImages = boxesByImage.size;
  const totalBoxes = Object.values(perClassCount).reduce((a, b) => a + b, 0);

  console.log("\n─── Annotator → YOLO ───────────────────────────────");
  console.log(`Images in export      : ${images.length}`);
  console.log(`Images with boxes     : ${labeledImages}`);
  console.log(`Total boxes           : ${totalBoxes}\n`);
  console.log("Boxes per class:");
  for (const cls of CLASS_ORDER) {
    const n = perClassCount[cls];
    // Rough practical floor for fine-tuning a class on top of pretrained YOLO.
    const verdict = n === 0 ? "NONE" : n < 50 ? "too few" : n < 200 ? "thin" : "ok";
    console.log(`  ${cls.padEnd(14)} ${String(n).padStart(6)}  ${verdict}`);
  }
  console.log("\nSkipped:");
  console.log(`  score-only (Wrinkles / Sagging) : ${skipped.scoreOnly}`);
  console.log(`  unknown category                : ${skipped.unknownCategory}`);
  console.log(`  degenerate points               : ${skipped.badPoints}`);
  console.log(`  below --min-box                 : ${skipped.tooSmall}`);
  if (unknownCategories.size > 0) {
    console.log(`  unknown names: ${[...unknownCategories].join(", ")}`);
  }

  if (args.dry) {
    console.log("\n--dry set — no files written.\n");
    return;
  }
  if (!args.out || !args.images) {
    console.error("\n--out and --images are required to write a dataset.\n");
    process.exit(1);
  }

  // ── write dataset ─────────────────────────────────────────────────
  const outRoot = resolve(args.out);
  const imagesRoot = resolve(args.images);
  for (const split of ["train", "val"]) {
    mkdirSync(join(outRoot, "images", split), { recursive: true });
    mkdirSync(join(outRoot, "labels", split), { recursive: true });
  }

  let written = 0;
  let missingImages = 0;
  const splitCount = { train: 0, val: 0 };

  for (const [idx, boxes] of boxesByImage.entries()) {
    const meta = images[idx];
    const fileName = meta?.fileName;
    if (!fileName) continue;
    const srcPath = join(imagesRoot, fileName);
    if (!existsSync(srcPath)) {
      missingImages += 1;
      continue;
    }
    const split = hashUnit(fileName, args.seed) < args.val ? "val" : "train";
    splitCount[split] += 1;

    copyFileSync(srcPath, join(outRoot, "images", split, fileName));
    const stem = basename(fileName, extname(fileName));
    const lines = boxes.map(
      (b) =>
        `${b.classIndex} ${b.cx.toFixed(6)} ${b.cy.toFixed(6)} ` +
        `${b.w.toFixed(6)} ${b.h.toFixed(6)}`
    );
    writeFileSync(
      join(outRoot, "labels", split, `${stem}.txt`),
      `${lines.join("\n")}\n`,
      "utf8"
    );
    written += 1;
  }

  writeFileSync(
    join(outRoot, "data.yaml"),
    [
      `path: ${outRoot.replace(/\\/g, "/")}`,
      "train: images/train",
      "val: images/val",
      "",
      `nc: ${CLASS_ORDER.length}`,
      `names: [${CLASS_ORDER.map((c) => `"${c}"`).join(", ")}]`,
      "",
    ].join("\n"),
    "utf8"
  );

  console.log(`\nWrote ${written} image/label pairs → ${outRoot}`);
  console.log(`  train: ${splitCount.train}   val: ${splitCount.val}`);
  if (missingImages > 0) {
    console.log(
      `  WARNING: ${missingImages} images referenced in the export were not ` +
        `found in ${imagesRoot} — those labels were dropped.`
    );
  }
  console.log("");
}

main();
