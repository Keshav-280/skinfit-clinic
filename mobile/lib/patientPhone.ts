export {
  displayUserPhone,
  formatPhoneForDisplay,
  normalizeCountryCode,
  normalizeNationalPhoneDigits,
  validateNationalPhone,
  type PhoneValidation,
} from "../../src/lib/auth/phone";

import { validateNationalPhone } from "../../src/lib/auth/phone";

export function patientHasPhoneOnFile(
  phone: string | null | undefined
): boolean {
  const n = phone?.trim();
  if (!n) return false;
  return validateNationalPhone(n).ok;
}
