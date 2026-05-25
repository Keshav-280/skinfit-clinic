import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!instance) {
    const driver = process.env.STORAGE_DRIVER?.trim() || "local";
    if (driver === "r2") {
      throw new Error("R2StorageProvider not enabled — use STORAGE_DRIVER=local");
    }
    instance = new LocalStorageProvider();
  }
  return instance;
}

export type { StorageProvider } from "./types";
export { LocalStorageProvider } from "./local";
