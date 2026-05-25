import "./polyfillCrypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  asyncStorageE2eeAdapter,
  decryptMessages,
  encryptOutgoingText,
  ensureDoctorPatientE2eeReady,
  resetDoctorPatientE2eeEnvelopes,
  setupDoctorPatientE2ee,
  type ChatMessageRow,
  type DoctorThreadE2eeSession,
} from "./chatE2ee/client";
import { apiUrl } from "./apiBase";

const storage = asyncStorageE2eeAdapter(
  (key) => AsyncStorage.getItem(key),
  (key, value) => AsyncStorage.setItem(key, value),
  (keys) => AsyncStorage.multiRemove(keys)
);

function mobileE2eeFetch(token: string) {
  return (path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(apiUrl(path), { ...init, headers, credentials: "omit" });
  };
}

function e2eeOpts(token: string) {
  return {
    storage,
    credentials: "omit" as const,
    fetchFn: mobileE2eeFetch(token),
  };
}

export async function setupMobileDoctorChatE2ee(
  token: string
): Promise<DoctorThreadE2eeSession | null> {
  return setupDoctorPatientE2ee(e2eeOpts(token));
}

export async function ensureMobileDoctorChatE2eeReady(
  token: string,
  maxAttempts?: number
): Promise<DoctorThreadE2eeSession | null> {
  return ensureDoctorPatientE2eeReady({ ...e2eeOpts(token), maxAttempts });
}

export async function resetMobileDoctorChatE2eeEnvelopes(
  token: string
): Promise<boolean> {
  return resetDoctorPatientE2eeEnvelopes(e2eeOpts(token));
}

/** Wipe device E2EE keys (run after server reset-all). */
export async function clearMobileE2eeDeviceKeys(): Promise<void> {
  await storage.clearKeyPair();
}

/** Server envelopes + local keys — full fresh bootstrap. */
export async function resetMobileDoctorChatE2eeFresh(
  token: string
): Promise<boolean> {
  await storage.clearKeyPair();
  return resetDoctorPatientE2eeEnvelopes(e2eeOpts(token));
}

export {
  decryptMessages,
  encryptOutgoingText,
  type ChatMessageRow,
  type DoctorThreadE2eeSession,
};
