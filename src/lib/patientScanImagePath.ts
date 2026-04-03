/** Cookie- or Bearer-authenticated image bytes for dashboard / mobile list + detail. */
export function patientScanImagePath(scanId: number): string {
  return `/api/patient/scans/${scanId}/image`;
}
