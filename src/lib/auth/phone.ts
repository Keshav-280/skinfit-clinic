const MAX_NATIONAL_DIGITS = 15;
const MIN_NATIONAL_DIGITS = 10;

/** E.164 country code: + then 1-3 digits (common cases). */
const COUNTRY_CODE_REGEX = /^\+[1-9]\d{0,3}$/;

/**
 * Normalizes country calling code; defaults to +91 when empty or invalid.
 */
export function normalizeCountryCode(input: string | undefined | null): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return "+91";
  const withPlus = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  if (COUNTRY_CODE_REGEX.test(withPlus)) return withPlus;
  return "+91";
}

/**
 * Digits-only national number for storage (no country code).
 */
export function normalizeNationalPhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export type PhoneValidation =
  | { ok: true; nationalDigits: string }
  | { ok: false; message: string };

/**
 * Validates national (local) phone digits - at least {@link MIN_NATIONAL_DIGITS} digits.
 */
export function validateNationalPhone(input: string): PhoneValidation {
  const nationalDigits = normalizeNationalPhoneDigits(input);
  if (!nationalDigits.length) {
    return { ok: false, message: "Please enter your phone number." };
  }
  if (nationalDigits.length < MIN_NATIONAL_DIGITS) {
    return {
      ok: false,
      message: `Phone number must include at least ${MIN_NATIONAL_DIGITS} digits.`,
    };
  }
  if (nationalDigits.length > MAX_NATIONAL_DIGITS) {
    return { ok: false, message: "Phone number has too many digits." };
  }
  return { ok: true, nationalDigits };
}

/** Display: country code + spaced national digits. */
export function formatPhoneForDisplay(
  countryCode: string | null | undefined,
  nationalDigits: string | null | undefined
): string | null {
  const cc = normalizeCountryCode(countryCode ?? "+91");
  const digits = nationalDigits?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return `${cc} ${digits}`;
}

/**
 * Renders a stored phone for UI. Handles legacy rows where `national` held a full international string.
 */
export function displayUserPhone(
  countryCode: string | null | undefined,
  nationalOrLegacy: string | null | undefined
): string | null {
  const raw = nationalOrLegacy?.trim() ?? "";
  if (!raw) return null;
  if (raw.startsWith("+") || /\s/.test(raw)) {
    return raw;
  }
  return formatPhoneForDisplay(countryCode, raw);
}
