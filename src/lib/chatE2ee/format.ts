/** Stored in `chat_messages.text` for E2EE payloads. Server must not parse body. */
export const E2EE_PREFIX = "e2ee:v1:";

export function isE2eePayload(text: string): boolean {
  return text.startsWith(E2EE_PREFIX);
}

function b64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64Decode(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function packE2eePayload(iv: Uint8Array, ciphertext: Uint8Array): string {
  return `${E2EE_PREFIX}${b64Encode(iv)}:${b64Encode(ciphertext)}`;
}

export function unpackE2eePayload(
  text: string
): { iv: Uint8Array; ciphertext: Uint8Array } | null {
  if (!isE2eePayload(text)) return null;
  const body = text.slice(E2EE_PREFIX.length);
  const sep = body.indexOf(":");
  if (sep < 1) return null;
  try {
    return {
      iv: b64Decode(body.slice(0, sep)),
      ciphertext: b64Decode(body.slice(sep + 1)),
    };
  } catch {
    return null;
  }
}

export const E2EE_INBOX_PREVIEW = "Encrypted message";

export function inboxPreviewForText(text: string): string {
  if (isE2eePayload(text)) return E2EE_INBOX_PREVIEW;
  return text.replace(/\s+/g, " ").trim();
}
