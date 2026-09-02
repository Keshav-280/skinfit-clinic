/**
 * Doctor↔patient chat is plain text only (E2EE removed).
 * Legacy rows may still store `e2ee:v1:` bodies - use displayChatMessageText() in UIs.
 */

export const DOCTOR_CHAT_E2EE_OFF_PREVIEW =
  "Earlier encrypted message (not readable - send a new message)";

/** @deprecated Always false - E2EE is not supported. */
export function isDoctorChatE2eeEnabled(): boolean {
  return false;
}

/** @deprecated Always false - E2EE is not supported. */
export function isDoctorChatE2eeEnabledWeb(): boolean {
  return false;
}
