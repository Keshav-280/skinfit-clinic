const MAX_LEN = 32;

/** Minimum digits (E.164-style local part is often 10+). */
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

/**
 * Validates and normalizes phone for storage (trimmed string, max 32 chars).
 * Registration requires at least {@link MIN_DIGITS} digits.
 */
export function validateRegistrationPhone(
  input: string
):
  | { ok: true; value: string }
  | { ok: false; message: string } {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, message: "Please enter your phone number." };
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS) {
    return {
      ok: false,
      message: `Phone number must include at least ${MIN_DIGITS} digits.`,
    };
  }
  if (digits.length > MAX_DIGITS) {
    return { ok: false, message: "Phone number has too many digits." };
  }
  if (raw.length > MAX_LEN) {
    return { ok: false, message: "Phone number is too long." };
  }
  return { ok: true, value: raw };
}
