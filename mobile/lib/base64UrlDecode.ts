import { Buffer } from "buffer";

/** React Native `Buffer` often lacks the `base64url` encoding — decode manually. */
export function decodeBase64UrlToUtf8(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = padLen ? normalized + "=".repeat(padLen) : normalized;
  return Buffer.from(padded, "base64").toString("utf8");
}
