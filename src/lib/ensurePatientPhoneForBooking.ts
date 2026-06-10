import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import {
  normalizeCountryCode,
  validateNationalPhone,
} from "@/src/lib/auth/phone";
import { invalidateUserProfileCache } from "@/src/lib/infra";

export function patientHasPhoneOnFile(
  phone: string | null | undefined
): boolean {
  const n = phone?.trim();
  if (!n) return false;
  return validateNationalPhone(n).ok;
}

export type EnsurePatientPhoneResult =
  | { ok: true; phone: string; phoneCountryCode: string }
  | { ok: false; error: "PHONE_REQUIRED" | "INVALID_PHONE"; message: string };

/**
 * Ensures the patient has a valid phone on file before booking.
 * Optionally accepts phone fields in the request body and saves them to profile.
 */
export async function ensurePatientPhoneForBooking(input: {
  userId: string;
  existingPhone: string | null | undefined;
  existingCountryCode: string | null | undefined;
  bodyPhone?: unknown;
  bodyPhoneCountryCode?: unknown;
}): Promise<EnsurePatientPhoneResult> {
  let phone = input.existingPhone?.trim() || null;
  let phoneCountryCode = normalizeCountryCode(input.existingCountryCode);

  if (patientHasPhoneOnFile(phone)) {
    return { ok: true, phone: phone!, phoneCountryCode };
  }

  if (typeof input.bodyPhone === "string" && input.bodyPhone.trim()) {
    const phoneCheck = validateNationalPhone(input.bodyPhone);
    if (!phoneCheck.ok) {
      return { ok: false, error: "INVALID_PHONE", message: phoneCheck.message };
    }
    phoneCountryCode = normalizeCountryCode(
      typeof input.bodyPhoneCountryCode === "string"
        ? input.bodyPhoneCountryCode
        : "+91"
    );
    phone = phoneCheck.nationalDigits;
    await db
      .update(users)
      .set({
        phone,
        phoneCountryCode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
    await invalidateUserProfileCache(input.userId);
    return { ok: true, phone, phoneCountryCode };
  }

  return {
    ok: false,
    error: "PHONE_REQUIRED",
    message:
      "Add your phone number in Profile or enter it when booking so the clinic can reach you.",
  };
}
