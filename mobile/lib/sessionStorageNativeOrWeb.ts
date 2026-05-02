import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Avoid collisions if other code uses the same raw keys in localStorage. */
const WEB_PREFIX = "skinfit_secure_";

export async function sessionGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(WEB_PREFIX + key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function sessionSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(WEB_PREFIX + key, value);
    } catch {
      /* private mode / quota */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function sessionDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(WEB_PREFIX + key);
    } catch {
      /* */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
