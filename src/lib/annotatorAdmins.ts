/** Annotator admins may edit/delete any collaborator's shapes and bypass image locks. */
const ANNOTATOR_ADMIN_EMAILS = new Set(
  [
    "prabhu@ambaforlife.org",
    "prabhu.m@ambaforlife.org",
    "ajaydey1946@gmail.com",
    "iamdalves@gmail.com",
    "soujanya.c@ambaforlife.org",
  ].map((e) => e.toLowerCase())
);

export function isAnnotatorAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ANNOTATOR_ADMIN_EMAILS.has(email.trim().toLowerCase());
}
