/** Device key storage for E2EE (private key never sent to server). */

export type E2eeKeyStorage = {
  getPrivateJwk(): Promise<JsonWebKey | null>;
  getPublicJwk(): Promise<JsonWebKey | null>;
  setKeyPair(publicJwk: JsonWebKey, privateJwk: JsonWebKey): Promise<void>;
  clearKeyPair(): Promise<void>;
};

export const E2EE_STORAGE_KEYS = {
  private: "skinfit_e2ee_private_jwk",
  public: "skinfit_e2ee_public_jwk",
} as const;

const PRIVATE_KEY = E2EE_STORAGE_KEYS.private;
const PUBLIC_KEY = E2EE_STORAGE_KEYS.public;

export const webE2eeKeyStorage: E2eeKeyStorage = {
  async getPrivateJwk() {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(PRIVATE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JsonWebKey;
    } catch {
      return null;
    }
  },
  async getPublicJwk() {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(PUBLIC_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JsonWebKey;
    } catch {
      return null;
    }
  },
  async setKeyPair(publicJwk, privateJwk) {
    if (typeof window === "undefined") return;
    localStorage.setItem(PRIVATE_KEY, JSON.stringify(privateJwk));
    localStorage.setItem(PUBLIC_KEY, JSON.stringify(publicJwk));
  },
  async clearKeyPair() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(PRIVATE_KEY);
    localStorage.removeItem(PUBLIC_KEY);
  },
};

export function asyncStorageE2eeAdapter(
  getItem: (key: string) => Promise<string | null>,
  setItem: (key: string, value: string) => Promise<void>,
  removeItems?: (keys: string[]) => Promise<void>
): E2eeKeyStorage {
  return {
    async getPrivateJwk() {
      const raw = await getItem(PRIVATE_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as JsonWebKey;
      } catch {
        return null;
      }
    },
    async getPublicJwk() {
      const raw = await getItem(PUBLIC_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as JsonWebKey;
      } catch {
        return null;
      }
    },
    async setKeyPair(publicJwk, privateJwk) {
      await setItem(PRIVATE_KEY, JSON.stringify(privateJwk));
      await setItem(PUBLIC_KEY, JSON.stringify(publicJwk));
    },
    async clearKeyPair() {
      if (removeItems) {
        await removeItems([PRIVATE_KEY, PUBLIC_KEY]);
        return;
      }
      await setItem(PRIVATE_KEY, "");
      await setItem(PUBLIC_KEY, "");
    },
  };
}
