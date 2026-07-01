export function defaultOutputBasename(uploadName: string): string {
  const stem = uploadName.replace(/\.pdf$/i, "").trim() || "report";
  return `skinfit-${stem}`;
}

/** e.g. "Saikat" → "skinfit-report_Saikat" */
export function outputBasenameFromPatientName(patientName: string): string {
  const safe = patientName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return safe ? `skinfit-report_${safe}` : "skinfit-report";
}

export function resolveOutputBasename(
  patientName: string,
  uploadName?: string | null
): string {
  if (patientName.trim()) return outputBasenameFromPatientName(patientName);
  if (uploadName?.trim()) return defaultOutputBasename(uploadName);
  return "skinfit-report";
}

export function sanitizeOutputFilename(raw: string, fallbackBasename: string): string {
  const trimmed = raw.trim() || fallbackBasename;
  const withoutExt = trimmed.replace(/\.pdf$/i, "").trim();
  const safe = withoutExt
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const base = safe || fallbackBasename;
  return `${base}.pdf`;
}
