/** Trimmed name from `users.name`, or fallback for empty values. */
export function doctorDisplayName(raw: string | null | undefined): string {
  const n = (raw ?? "").trim();
  return n.length > 0 ? n : "Doctor";
}

/** Patient-facing label — normalizes “Doctor Ruby”, “Dr Ruby”, etc. to “Dr. Ruby”. */
export function patientDoctorLabel(
  raw: string | null | undefined,
  fallback = "Doctor"
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback;
  const withoutTitle = trimmed.replace(/^(dr\.?|doctor)\s+/i, "").trim();
  if (!withoutTitle) return fallback;
  return `Dr. ${withoutTitle}`;
}

/**
 * Title for “My calendar” rows sourced from `appointments` + doctor user.
 * Avoids awkward doubling if the type label already implies a visit.
 */
export function appointmentCalendarTitle(
  typeLabel: string,
  doctorName: string
): string {
  const dr = doctorDisplayName(doctorName);
  return `${typeLabel} with ${dr}`;
}
