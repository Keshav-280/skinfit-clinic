export type ClinicDeviceReportKind = "medixora" | "inbody";

export function parseClinicDeviceReportKind(
  value: unknown
): ClinicDeviceReportKind | null {
  return value === "medixora" || value === "inbody" ? value : null;
}

export function clinicDeviceReportLabel(kind: ClinicDeviceReportKind): string {
  return kind === "inbody" ? "InBody report" : "Medixora report";
}

/** Prefer the uploaded file name; fall back to Medixora / InBody for older rows. */
export function clinicDeviceReportDisplayTitle(
  title: string | null | undefined,
  kind?: ClinicDeviceReportKind | null
): string {
  const raw = title?.trim() ?? "";
  if (
    raw &&
    !/ - (Medixora|InBody) report$/i.test(raw) &&
    raw.toLowerCase() !== "medixora report" &&
    raw.toLowerCase() !== "inbody report"
  ) {
    return raw;
  }
  return (kind ? clinicDeviceReportLabel(kind) : raw) || "Clinic report";
}

export function sanitizeClinicReportFileName(
  name: string,
  fallbackExt: string
): string {
  const trimmed = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  const base = trimmed || `report.${fallbackExt}`;
  return base.slice(0, 255);
}

export type PatientDeviceReportRow = {
  id: string;
  title: string;
  reportKind: ClinicDeviceReportKind;
  createdAt: string;
  downloadUrl: string;
};
