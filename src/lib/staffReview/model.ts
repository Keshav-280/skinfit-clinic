/**
 * Scores and markings that clinic staff give to an app scan. When a scan carries a staff review,
 * the patient sees exactly these numbers: no model curve, no early-scan limit, no estimate.
 * Pure module (safe in the browser and in the ml-worker).
 */

/** Promised to patients: their report is ready within this many hours. */
export const REVIEW_HOURS = 48;

export const STAFF_AREAS = [
  { key: "active_acne", label: "Active acne" },
  { key: "acne_scar", label: "Acne scars" },
  { key: "pigmentation", label: "Pigmentation" },
  { key: "under_eye", label: "Under-eye" },
  { key: "wrinkles", label: "Wrinkles" },
  { key: "sagging_volume", label: "Sagging and volume" },
] as const;

export type StaffAreaKey = (typeof STAFF_AREAS)[number]["key"];
export type StaffScores = Record<StaffAreaKey, number>;

export const VIEWS = ["front", "left", "right"] as const;
export type PhotoView = (typeof VIEWS)[number];

type Point = { x: number; y: number };
/** Coordinates are fractions of the photo's width and height; a circle's radius is a fraction of the width. */
export type StaffShape = { view: PhotoView; area: StaffAreaKey } & (
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "curve"; points: Point[] }
);

export type StaffReview = {
  version: 1;
  scores: StaffScores;
  overall: number;
  note: string;
  shapes: StaffShape[];
  reviewer: string;
  reviewedAt: string;
};

const MAX_SHAPES = 600;
const MAX_POINTS = 400;
export const MAX_NOTE = 600;

const unit = (v: unknown) => (typeof v === "number" && v >= -0.05 && v <= 1.05 ? v : null);
const score = (v: unknown) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100 ? v : null;

/** The marking tool stores the area as `param` and calls acne scars `acne_scars`. */
const areaKey = (v: unknown): StaffAreaKey | null => {
  const key = v === "acne_scars" ? "acne_scar" : v;
  return STAFF_AREAS.find((a) => a.key === key)?.key ?? null;
};

/** Rebuilds markings from untrusted input; anything malformed is dropped. */
export function sanitizeShapes(raw: unknown): StaffShape[] {
  if (!Array.isArray(raw)) return [];
  const out: StaffShape[] = [];
  for (const item of raw.slice(0, MAX_SHAPES)) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const view = VIEWS.find((v) => v === (s.view ?? "front"));
    const area = areaKey(s.area ?? s.param);
    if (!view || !area) continue;
    if (s.type === "circle") {
      const [cx, cy, r] = [unit(s.cx), unit(s.cy), unit(s.r)];
      if (cx != null && cy != null && r != null && r > 0) out.push({ view, area, type: "circle", cx, cy, r });
    } else if (s.type === "line") {
      const [x1, y1, x2, y2] = [unit(s.x1), unit(s.y1), unit(s.x2), unit(s.y2)];
      if (x1 != null && y1 != null && x2 != null && y2 != null) out.push({ view, area, type: "line", x1, y1, x2, y2 });
    } else if (s.type === "curve" && Array.isArray(s.points)) {
      const points = s.points.slice(0, MAX_POINTS).flatMap((p) => {
        const q = (p ?? {}) as Record<string, unknown>;
        const [x, y] = [unit(q.x), unit(q.y)];
        return x != null && y != null ? [{ x, y }] : [];
      });
      if (points.length >= 2) out.push({ view, area, type: "curve", points });
    }
  }
  return out;
}

/** All six scores as whole numbers from 1 to 100, or null with the missing areas named. */
export function readSixScores(raw: unknown): { scores: StaffScores } | { missing: string[] } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const scores: Partial<StaffScores> = {};
  const missing: string[] = [];
  for (const area of STAFF_AREAS) {
    const v = score(o[area.key] ?? (area.key === "acne_scar" ? o.acne_scars : undefined));
    if (v == null) missing.push(area.label);
    else scores[area.key] = v;
  }
  return missing.length ? { missing } : { scores: scores as StaffScores };
}

export const averageScore = (s: StaffScores) =>
  Math.round(STAFF_AREAS.reduce((sum, a) => sum + s[a.key], 0) / STAFF_AREAS.length);

export function readStaffReview(scoresJson: unknown): StaffReview | null {
  if (!scoresJson || typeof scoresJson !== "object") return null;
  const r = (scoresJson as { staffReview?: unknown }).staffReview;
  if (!r || typeof r !== "object") return null;
  const six = readSixScores((r as { scores?: unknown }).scores);
  if (!("scores" in six)) return null;
  const x = r as Partial<StaffReview>;
  return {
    version: 1,
    scores: six.scores,
    overall: averageScore(six.scores),
    note: typeof x.note === "string" ? x.note : "",
    shapes: sanitizeShapes(x.shapes),
    reviewer: typeof x.reviewer === "string" ? x.reviewer : "",
    reviewedAt: typeof x.reviewedAt === "string" ? x.reviewedAt : "",
  };
}

export const isStaffScored = (scoresJson: unknown) => readStaffReview(scoresJson) != null;

/**
 * Staff scores are a different measure from the old model scores, so a staff-scored scan is only
 * ever compared with other staff-scored scans. `current` is the scan being described.
 */
export function comparableScans<T extends { scores?: unknown }>(currentScores: unknown, rows: T[]): T[] {
  return isStaffScored(currentScores) ? rows.filter((r) => isStaffScored(r.scores)) : rows;
}
