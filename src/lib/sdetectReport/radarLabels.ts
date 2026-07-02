/**
 * Comprehensive Analysis radar axes — 11 parameters on newer Medixora reports.
 * Clockwise from top (matches dr.pdf / ka.pdf layout).
 */
export const SDETECT_RADAR_LABELS = [
  "Superficial pigment",
  "Brown pigment",
  "Mixed spot",
  "Collagen",
  "Sebum",
  "Pores",
  "Acne",
  "Deep Pigment",
  "Heat Map of Sensitivity",
  "Red Map of Sensitivity",
  "Wrinkle",
] as const;

export type SdetectRadarLabel = (typeof SDETECT_RADAR_LABELS)[number];

/** @deprecated Use SDETECT_RADAR_LABELS */
export const RADAR_LABELS = SDETECT_RADAR_LABELS;
