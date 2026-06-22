export function defaultOutputBasename(uploadName: string): string {
  const stem = uploadName.replace(/\.pdf$/i, "").trim() || "report";
  return `skinfit-${stem}`;
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
