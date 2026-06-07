import { timingSafeEqual } from "node:crypto";

export function getDoctorPortalSecurityCode(): string | null {
  const code = process.env.DOCTOR_PORTAL_SECURITY_CODE?.trim();
  return code || null;
}

export function isDoctorPortalSecurityCodeConfigured(): boolean {
  return getDoctorPortalSecurityCode() !== null;
}

export function verifyDoctorPortalSecurityCode(code: string): boolean {
  const expected = getDoctorPortalSecurityCode();
  if (!expected) return false;
  const actual = Buffer.from(String(code));
  const expectedBuf = Buffer.from(expected);
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}
