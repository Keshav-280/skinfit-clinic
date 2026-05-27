import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { R2StorageProvider } from "./r2";

let instance: StorageProvider | null = null;
let instanceDriver: string | null = null;

export function getStorage(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER?.trim() || "local";
  if (instance && instanceDriver === driver) return instance;

  instance =
    driver === "r2" ? new R2StorageProvider() : new LocalStorageProvider();
  instanceDriver = driver;
  return instance;
}

export type { StorageProvider } from "./types";
export { LocalStorageProvider } from "./local";
export { R2StorageProvider } from "./r2";
