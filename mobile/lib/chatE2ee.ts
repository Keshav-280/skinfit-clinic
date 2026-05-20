import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  asyncStorageE2eeAdapter,
  decryptMessages,
  encryptOutgoingText,
  setupDoctorPatientE2ee,
  type ChatMessageRow,
  type DoctorThreadE2eeSession,
} from "../../src/lib/chatE2ee/client";
import { apiUrl } from "./apiBase";

const storage = asyncStorageE2eeAdapter(
  (key) => AsyncStorage.getItem(key),
  (key, value) => AsyncStorage.setItem(key, value)
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

export async function setupMobileDoctorChatE2ee(
  token: string
): Promise<DoctorThreadE2eeSession | null> {
  return setupDoctorPatientE2ee({
    storage,
    credentials: "omit",
    fetchFn: mobileE2eeFetch(token),
  });
}

export { decryptMessages, encryptOutgoingText, type ChatMessageRow, type DoctorThreadE2eeSession };
