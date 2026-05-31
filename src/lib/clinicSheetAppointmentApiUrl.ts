/**
 * Public URL for sheet → Skinfit CRM webhook (`POST …/api/integrations/clinic-sheet/appointments`).
 * Written into column `appointmentSyncUrl` on each new schedule-request row.
 */
export function clinicSheetAppointmentApiUrlFromEnv(): string | null {
  const origin =
    process.env.CLINIC_SHEET_APPOINTMENT_API_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim();
  if (!origin) return null;
  const base = origin.replace(/\/$/, "");
  return `${base}/api/integrations/clinic-sheet/appointments`;
}
