/**
 * What we know about HOW a scan was taken, saved with the scan so the report writer can use it:
 *  - occlusions: things the patient told us are on their face today (beard, glasses, makeup);
 *  - photos: for each pose, the live lighting and framing result at the moment of capture, or
 *    "unchecked" for a photo that was uploaded and never went through the live check.
 *
 * Everything coming from the browser is untrusted: only known values are kept.
 */

export const OCCLUSION_OPTIONS = ["beard", "glasses", "makeup"] as const;
export type Occlusion = (typeof OCCLUSION_OPTIONS)[number];

const LIGHTING = ["good", "too_dark", "too_bright", "uneven", "low_contrast"] as const;
const FRAMING = ["good", "too_small", "too_large", "off_center", "no_face"] as const;
const POSES = ["centre", "left", "right", "smiling", "eyes_closed"] as const;

export type CaptureQualityPhoto = {
  pose: string;
  lighting: (typeof LIGHTING)[number] | null;
  framing: (typeof FRAMING)[number] | null;
  /** False when the photo was uploaded and never went through the live check. */
  checked: boolean;
};

export type CaptureMeta = {
  occlusions: Occlusion[];
  photos: CaptureQualityPhoto[];
};

function pick<T extends readonly string[]>(list: T, v: unknown): T[number] | null {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : null;
}

/** Keeps only known values; returns undefined when nothing usable is left. */
export function sanitizeCaptureMeta(raw: unknown): CaptureMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;

  const occlusions = Array.isArray(r.occlusions)
    ? Array.from(
        new Set(
          r.occlusions.filter((x): x is Occlusion =>
            (OCCLUSION_OPTIONS as readonly string[]).includes(x as string)
          )
        )
      )
    : [];

  const photos: CaptureQualityPhoto[] = [];
  if (Array.isArray(r.photos)) {
    for (const p of r.photos.slice(0, 8)) {
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const pose = pick(POSES, o.pose);
      if (!pose) continue;
      const lighting = pick(LIGHTING, o.lighting);
      const framing = pick(FRAMING, o.framing);
      photos.push({ pose, lighting, framing, checked: lighting != null || framing != null });
    }
  }

  if (occlusions.length === 0 && photos.length === 0) return undefined;
  return { occlusions, photos };
}

export function parseCaptureMeta(formData: { get(name: string): unknown }): CaptureMeta | undefined {
  const raw = formData.get("captureMeta");
  if (typeof raw !== "string" || !raw.trim() || raw.length > 4000) return undefined;
  try {
    return sanitizeCaptureMeta(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/** The shape the report writer receives; undefined when the scan has no capture details. */
export function captureQualityForReport(scores: unknown): CaptureMeta | undefined {
  if (!scores || typeof scores !== "object") return undefined;
  return sanitizeCaptureMeta((scores as Record<string, unknown>).captureMeta);
}

export type CaptureState = "comparable" | "degraded" | "unusable";

/**
 * How trustworthy this scan's photos are for comparing with an earlier scan, decided here in code
 * (never left to the AI): unusable when the front photo shows no face; degraded when any photo that
 * went through the live check had lighting or framing that was not good; otherwise comparable.
 */
export function captureStateOf(meta: CaptureMeta | undefined | null): CaptureState {
  if (!meta) return "comparable";
  const front = meta.photos.find((p) => p.pose === "centre");
  if (front?.framing === "no_face") return "unusable";
  const bad = meta.photos.some(
    (p) => p.checked && ((p.lighting != null && p.lighting !== "good") || (p.framing != null && p.framing !== "good"))
  );
  return bad ? "degraded" : "comparable";
}

/** When the photos are not comparable, no area may claim movement: it becomes "tracking". */
export function applyCaptureToMovement<T extends { movement?: string; change_points?: number | null; compared_with?: string | null; previous_score_100?: number | null }>(
  rows: T[],
  state: CaptureState
): T[] {
  if (state === "comparable") return rows;
  return rows.map((r) => ({ ...r, movement: "tracking", change_points: null, compared_with: null, previous_score_100: null }));
}
