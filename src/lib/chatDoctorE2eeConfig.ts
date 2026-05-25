/**
 * Doctor↔patient chat E2EE toggle.
 *
 * **Off by default** (plain text in `chat_messages`). To turn encryption back on:
 *
 * Server (API / doctor portal):
 *   CHAT_DOCTOR_E2EE_ENABLED=1
 *
 * Web patient chat (Next.js):
 *   NEXT_PUBLIC_CHAT_DOCTOR_E2EE_ENABLED=1
 *
 * Mobile (Expo):
 *   EXPO_PUBLIC_CHAT_DOCTOR_E2EE_ENABLED=1
 *
 * Force off (overrides ENABLED):
 *   CHAT_DOCTOR_E2EE_DISABLED=1
 *   NEXT_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED=1
 *   EXPO_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED=1
 */

function envTruthy(raw: string | undefined): boolean {
  const t = raw?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

function envDisabled(raw: string | undefined): boolean {
  const t = raw?.trim().toLowerCase();
  return (
    t === "1" ||
    t === "true" ||
    t === "yes" ||
    t === "on" ||
    t === "0" ||
    t === "false" ||
    t === "off"
  );
}

function anyDisabled(): boolean {
  return (
    envDisabled(process.env.CHAT_DOCTOR_E2EE_DISABLED) ||
    envDisabled(process.env.DISABLE_DOCTOR_CHAT_E2EE) ||
    envDisabled(process.env.NEXT_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED) ||
    envDisabled(process.env.EXPO_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED)
  );
}

function anyEnabled(): boolean {
  return (
    envTruthy(process.env.CHAT_DOCTOR_E2EE_ENABLED) ||
    envTruthy(process.env.NEXT_PUBLIC_CHAT_DOCTOR_E2EE_ENABLED) ||
    envTruthy(process.env.EXPO_PUBLIC_CHAT_DOCTOR_E2EE_ENABLED)
  );
}

/** Server-side (API routes, doctor portal SSR). */
export function isDoctorChatE2eeEnabled(): boolean {
  if (anyDisabled()) return false;
  return anyEnabled();
}

/** Browser patient chat (`NEXT_PUBLIC_*` baked at build). */
export function isDoctorChatE2eeEnabledWeb(): boolean {
  if (typeof window !== "undefined") {
    if (envDisabled(process.env.NEXT_PUBLIC_CHAT_DOCTOR_E2EE_DISABLED)) {
      return false;
    }
    return envTruthy(process.env.NEXT_PUBLIC_CHAT_DOCTOR_E2EE_ENABLED);
  }
  return isDoctorChatE2eeEnabled();
}

/** Shown when E2EE is off but legacy rows are still ciphertext. */
export const DOCTOR_CHAT_E2EE_OFF_PREVIEW =
  "Message from your clinic (encryption is turned off)";
