/**
 * Phone-only patients still need a unique `users.email` (column is NOT NULL
 * UNIQUE and the session token carries it). They get a non-deliverable
 * placeholder address; outbound email to it is skipped (see smtpMail.ts).
 */
const PLACEHOLDER_DOMAIN = "phone.skinfitwellness.in";

export function placeholderEmailForPhone(
  countryCode: string,
  nationalDigits: string
): string {
  return `${countryCode.replace(/\D/g, "")}${nationalDigits}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);
}
