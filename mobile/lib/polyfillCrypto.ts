/**
 * Polyfill Web Crypto.subtle for React Native.
 * In Expo Go the native QuickCrypto module isn't linked, so we silently skip
 * and E2EE features show "not supported on this device".
 * In a dev/standalone build the native module loads and E2EE works.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import "react-native-get-random-values";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function ensureWebCryptoPolyfill(): boolean {
  if (typeof globalThis.crypto?.subtle !== "undefined") return true;
  if (isExpoGo) return false;
  try {
    const { install } = require("react-native-quick-crypto") as {
      install: () => void;
    };
    install();
  } catch (e) {
    console.warn("[polyfillCrypto] quick-crypto unavailable", e);
  }
  return typeof globalThis.crypto?.subtle !== "undefined";
}

ensureWebCryptoPolyfill();
