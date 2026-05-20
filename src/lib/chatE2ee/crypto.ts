/**
 * Web Crypto helpers for doctor↔patient E2EE (browser + Node 18+).
 * Thread AES-256-GCM keys are wrapped per user with RSA-OAEP-2048.
 */

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error("Web Crypto API is not available in this environment.");
  }
  return c.subtle;
}

/** Normalize Uint8Array for SubtleCrypto (strict ArrayBuffer typing in TS 5.x). */
function bufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

export type E2eeKeyPair = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
};

export async function generateUserKeyPair(): Promise<E2eeKeyPair> {
  const pair = await subtle().generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const publicKeyJwk = await subtle().exportKey("jwk", pair.publicKey);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey, publicKeyJwk };
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function generateThreadAesKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportRawAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await subtle().exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importRawAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey("raw", bufferSource(raw), { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapThreadKeyForUser(
  threadAesKey: CryptoKey,
  userPublicKey: CryptoKey
): Promise<string> {
  const raw = await exportRawAesKey(threadAesKey);
  const wrapped = await subtle().encrypt(
    { name: "RSA-OAEP" },
    userPublicKey,
    bufferSource(raw)
  );
  return b64FromBytes(new Uint8Array(wrapped));
}

export async function unwrapThreadKeyForUser(
  wrappedKeyB64: string,
  userPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const wrapped = b64ToBytes(wrappedKeyB64);
  const raw = await subtle().decrypt(
    { name: "RSA-OAEP" },
    userPrivateKey,
    bufferSource(wrapped)
  );
  return importRawAesKey(new Uint8Array(raw));
}

export async function encryptChatBody(
  plaintext: string,
  threadAesKey: CryptoKey
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv: bufferSource(iv) },
    threadAesKey,
    bufferSource(encoded)
  );
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decryptChatBody(
  iv: Uint8Array,
  ciphertext: Uint8Array,
  threadAesKey: CryptoKey
): Promise<string> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: bufferSource(iv) },
    threadAesKey,
    bufferSource(ciphertext)
  );
  return new TextDecoder().decode(plain);
}

function b64FromBytes(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
