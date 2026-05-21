/**
 * Expo Go has no native Web Crypto.subtle — E2EE is unavailable until a dev/production build.
 */
import "react-native-get-random-values";

export function ensureWebCryptoPolyfill(): boolean {
  return typeof globalThis.crypto?.subtle !== "undefined";
}

ensureWebCryptoPolyfill();
