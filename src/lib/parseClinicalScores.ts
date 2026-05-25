import type { ClinicalScores } from "@/components/dashboard/scanReportTypes";

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Reads `scans.scores.modelFeatureScores` saved by `/api/scan`. */
export function parseClinicalScores(raw: unknown): ClinicalScores | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const root = raw as Record<string, unknown>;
  const m = root.modelFeatureScores;
  if (!m || typeof m !== "object") return undefined;
  const o = m as Record<string, unknown>;
  const pig = o.pigmentation_model;
  const out: ClinicalScores = {
    active_acne: num(o.active_acne),
    acne_scars: num(o.acne_scars),
    skin_quality: num(o.skin_quality),
    wrinkle_severity: num(o.wrinkle_severity),
    wrinkle_cls_severity: num(o.wrinkle_cls_severity),
    wrinkle_seg_severity: num(o.wrinkle_seg_severity),
    sagging_volume: num(o.sagging_volume),
    under_eye: num(o.under_eye),
    hair_health: num(o.hair_health),
    pigmentation_model:
      pig === null ? null : num(pig) ?? undefined,
  };
  const hasAny = Object.values(out).some(
    (v) => v !== undefined && v !== null
  );
  return hasAny ? out : undefined;
}

function parseDataUriField(scores: unknown, key: string): string | undefined {
  if (!scores || typeof scores !== "object") return undefined;
  const v = (scores as Record<string, unknown>)[key];
  if (typeof v !== "string" || !v.startsWith("data:image/")) return undefined;
  if (v.length > 14_000_000) return undefined;
  return v;
}

/** Legacy data URIs or persisted file URLs (`overlayUrl`, `wrinkleMaskUrl`, etc.). */
function parseStoredImageRef(
  scores: unknown,
  urlKey: string,
  dataUriKey: string
): string | undefined {
  if (!scores || typeof scores !== "object") return undefined;
  const url = (scores as Record<string, unknown>)[urlKey];
  if (typeof url === "string") {
    const t = url.trim();
    if (
      t.startsWith("http://") ||
      t.startsWith("https://") ||
      t.startsWith("/api/files/")
    ) {
      return t;
    }
  }
  return parseDataUriField(scores, dataUriKey);
}

/** Reads `scans.scores.overlayDataUri` or `overlayUrl` (combined model overlay). */
export function parseScanOverlayDataUri(scores: unknown): string | undefined {
  return parseStoredImageRef(scores, "overlayUrl", "overlayDataUri");
}

export function parseScanWrinkleMaskDataUri(scores: unknown): string | undefined {
  return parseStoredImageRef(scores, "wrinkleMaskUrl", "wrinkleMaskDataUri");
}

export function parseScanAcneMaskDataUri(scores: unknown): string | undefined {
  return parseStoredImageRef(scores, "acneMaskUrl", "acneMaskDataUri");
}
