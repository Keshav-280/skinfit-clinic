export type ClinicDeviceReportKind = "medixora" | "inbody";

export function parseClinicDeviceReportKind(
  value: unknown
): ClinicDeviceReportKind | null {
  return value === "medixora" || value === "inbody" ? value : null;
}

export function clinicDeviceReportLabel(kind: ClinicDeviceReportKind): string {
  return kind === "inbody" ? "InBody report" : "Medixora report";
}

export type PatientDeviceReportRow = {
  id: string;
  title: string;
  reportKind: ClinicDeviceReportKind;
  createdAt: string;
  downloadUrl: string;
};
