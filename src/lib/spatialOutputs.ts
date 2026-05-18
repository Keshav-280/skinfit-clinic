/** Spatial head outputs from `/analyze_v2` (wrinkle seg map + acne 16×16 grid). */

export type WrinkleSpatialOutput = {
  pixel_mask: string;
  seg_head_drives_mask_and_seg_severity: boolean;
  cls_severity_1_5: number;
  seg_severity_1_5: number;
  combined_severity_1_5: number;
  mask_mean: number;
};

export type AcneSpatialOutput = {
  patch_grid: string;
  global_severity_1_5: number;
  patch_mean: number;
  patch_max: number;
};

export type ScanSpatialOutputs = {
  wrinkles: WrinkleSpatialOutput;
  acne: AcneSpatialOutput;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parseWrinkleSpatial(raw: unknown): WrinkleSpatialOutput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const cls = num(o.cls_severity_1_5);
  const seg = num(o.seg_severity_1_5);
  const combined = num(o.combined_severity_1_5);
  const maskMean = num(o.mask_mean);
  if (cls == null || seg == null || combined == null || maskMean == null) {
    return undefined;
  }
  return {
    pixel_mask: str(o.pixel_mask) ?? "224x224 probability map",
    seg_head_drives_mask_and_seg_severity:
      o.seg_head_drives_mask_and_seg_severity === true,
    cls_severity_1_5: cls,
    seg_severity_1_5: seg,
    combined_severity_1_5: combined,
    mask_mean: maskMean,
  };
}

function parseAcneSpatial(raw: unknown): AcneSpatialOutput | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const global = num(o.global_severity_1_5);
  const mean = num(o.patch_mean);
  const max = num(o.patch_max);
  if (global == null || mean == null || max == null) return undefined;
  return {
    patch_grid: str(o.patch_grid) ?? "16x16 objectness map",
    global_severity_1_5: global,
    patch_mean: mean,
    patch_max: max,
  };
}

export function parseScanSpatialOutputs(
  scores: unknown
): ScanSpatialOutputs | undefined {
  if (!scores || typeof scores !== "object") return undefined;
  const root = (scores as Record<string, unknown>).spatialOutputs;
  if (!root || typeof root !== "object") return undefined;
  const wrinkles = parseWrinkleSpatial(
    (root as Record<string, unknown>).wrinkles
  );
  const acne = parseAcneSpatial((root as Record<string, unknown>).acne);
  if (!wrinkles || !acne) return undefined;
  return { wrinkles, acne };
}

export function parseSpatialOutputsFromApi(
  body: unknown
): ScanSpatialOutputs | undefined {
  if (!body || typeof body !== "object") return undefined;
  const root = (body as Record<string, unknown>).spatialOutputs;
  if (!root || typeof root !== "object") return undefined;
  const wrinkles = parseWrinkleSpatial(
    (root as Record<string, unknown>).wrinkles
  );
  const acne = parseAcneSpatial((root as Record<string, unknown>).acne);
  if (!wrinkles || !acne) return undefined;
  return { wrinkles, acne };
}
