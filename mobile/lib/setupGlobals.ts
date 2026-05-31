/**
 * Hermes does not provide Node globals. jpeg-js encode (brightness bake on capture)
 * calls global `Buffer` / `btoa` internally — polyfill before any scan modules load.
 */
import { Buffer as NodeBuffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = NodeBuffer;
}

if (typeof globalThis.btoa === "undefined") {
  globalThis.btoa = (data: string) =>
    NodeBuffer.from(data, "binary").toString("base64");
}

if (typeof globalThis.atob === "undefined") {
  globalThis.atob = (b64: string) =>
    NodeBuffer.from(b64, "base64").toString("binary");
}
