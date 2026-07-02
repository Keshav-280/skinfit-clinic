/** ISO 216 A4 — 210 × 297 mm (print standard). */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export const PDF_A4_OPTIONS = {
  orientation: "portrait" as const,
  unit: "mm" as const,
  format: "a4" as const,
};

/** Convert legacy point layout values to millimetres. */
export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}
