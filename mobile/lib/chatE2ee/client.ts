/**
 * E2EE client for doctor↔patient chat (React Native + web via storage adapter).
 */

import {
  decryptChatBody,
  encryptChatBody,
  generateThreadAesKey,
  generateUserKeyPair,
  importPrivateKey,
  importPublicKey,
  isWebCryptoAvailable,
  unwrapThreadKeyForUser,
  wrapThreadKeyForUser,
} from "./crypto";
import {
  isE2eePayload,
  packE2eePayload,
  unpackE2eePayload,
} from "./format";
import { type E2eeKeyStorage, webE2eeKeyStorage } from "./keyStorage";

export type { E2eeKeyStorage } from "./keyStorage";
export { webE2eeKeyStorage, asyncStorageE2eeAdapter } from "./keyStorage";

export type ChatMessageRow = {
  id: string;
  sender: string;
  text: string;
  attachmentUrl?: string | null;
  createdAt?: string;
};

export type DoctorThreadE2eeSession = {
  threadId: string;
  threadAesKey: CryptoKey | null;
  ready: boolean;
  status: string | null;
};

function unavailableSession(
  threadId: string,
  status: string
): DoctorThreadE2eeSession {
  return { threadId, threadAesKey: null, ready: false, status };
}

async function ensureLocalE2eeKeys(
  storage: E2eeKeyStorage,
  register: (publicKeyJwk: JsonWebKey) => Promise<void>
): Promise<CryptoKey> {
  let privateJwk = await storage.getPrivateJwk();
  let publicJwk = await storage.getPublicJwk();

  if (!privateJwk || !publicJwk) {
    const pair = await generateUserKeyPair();
    privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    publicJwk = pair.publicKeyJwk;
    await storage.setKeyPair(publicJwk, privateJwk);
  }

  await register(publicJwk);
  return importPrivateKey(privateJwk);
}

type E2eeFetchInit = RequestInit & { credentials?: RequestCredentials };

function isCryptoKeyMismatchError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === "OperationError" || e.name === "InvalidAccessError";
  }
  return e instanceof Error && /operationerror|decrypt/i.test(e.message);
}

async function resetDoctorThreadEnvelopes(
  http: (path: string, init: E2eeFetchInit) => Promise<Response>,
  opts: {
    patientId?: string;
    credentials?: RequestCredentials;
    authHeaders?: Record<string, string>;
  }
): Promise<boolean> {
  const qs = opts.patientId
    ? `?patientId=${encodeURIComponent(opts.patientId)}`
    : "";
  const res = await http(`/api/chat/e2ee/thread${qs}`, {
    method: "DELETE",
    credentials: opts.credentials ?? "include",
    headers: opts.authHeaders,
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return res.ok && Boolean(body.ok);
}

export async function setupDoctorPatientE2ee(opts: {
  patientId?: string;
  credentials?: RequestCredentials;
  storage?: E2eeKeyStorage;
  authHeaders?: Record<string, string>;
  fetchFn?: (path: string, init: E2eeFetchInit) => Promise<Response>;
  _envelopeResetAttempted?: boolean;
}): Promise<DoctorThreadE2eeSession | null> {
  if (!isWebCryptoAvailable()) {
    return unavailableSession(
      "",
      "Secure chat is not supported on this device."
    );
  }

  const storage = opts.storage ?? webE2eeKeyStorage;
  const credentials = opts.credentials ?? "include";
  const http = opts.fetchFn ?? ((path, init) => fetch(path, init));
  const headers = {
    "content-type": "application/json",
    ...opts.authHeaders,
  };

  let privateKey: CryptoKey;
  try {
    privateKey = await ensureLocalE2eeKeys(storage, async (publicKeyJwk) => {
      const res = await http("/api/chat/e2ee/keys", {
        method: "POST",
        credentials,
        headers,
        body: JSON.stringify({ publicKeyJwk }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const code = body.error ?? "KEY_REGISTER_FAILED";
        throw new Error(code);
      }
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "KEY_REGISTER_FAILED";
    const status =
      code === "E2EE_TABLE_MISSING"
        ? "Secure chat DB tables missing on server (run migration 0031). Chat works without encryption."
        : code === "USER_NOT_IN_DB"
          ? "Doctor account not in database — use a seeded doctor login. Chat works without encryption."
          : code === "UNAUTHORIZED"
            ? "Sign in again to enable secure chat."
            : "Could not register encryption keys. Chat still works without encryption.";
    return unavailableSession("", status);
  }

  const qs = opts.patientId
    ? `?patientId=${encodeURIComponent(opts.patientId)}`
    : "";
  const setupRes = await http(`/api/chat/e2ee/thread${qs}`, {
    credentials,
    headers: opts.authHeaders,
  });
  const setup = (await setupRes.json().catch(() => ({}))) as {
    ok?: boolean;
    threadId?: string;
    selfUserId?: string;
    peerUserId?: string;
    peerPublicKeyJwk?: JsonWebKey | null;
    wrappedThreadKeyB64?: string | null;
    hasThreadKeys?: boolean;
    ready?: boolean;
    peerHasPublicKey?: boolean;
  };

  if (!setupRes.ok || !setup.ok || !setup.threadId || !setup.selfUserId) {
    return unavailableSession(
      setup.threadId ?? "",
      "Could not load secure chat setup."
    );
  }

  if (setup.ready && setup.wrappedThreadKeyB64) {
    try {
      const threadAesKey = await unwrapThreadKeyForUser(
        setup.wrappedThreadKeyB64,
        privateKey
      );
      return { threadId: setup.threadId, threadAesKey, ready: true, status: null };
    } catch (e) {
      if (isCryptoKeyMismatchError(e) && !opts._envelopeResetAttempted) {
        const cleared = await resetDoctorThreadEnvelopes(http, {
          patientId: opts.patientId,
          credentials,
          authHeaders: opts.authHeaders,
        });
        if (cleared) {
          return setupDoctorPatientE2ee({
            ...opts,
            _envelopeResetAttempted: true,
          });
        }
      }
      console.warn("[setupDoctorPatientE2ee] unwrap thread key failed", e);
      return unavailableSession(
        setup.threadId,
        "Secure chat keys on the server no longer match this device. Reset secure chat and reopen chat."
      );
    }
  }

  if (!setup.peerHasPublicKey || !setup.peerPublicKeyJwk || !setup.peerUserId) {
    return unavailableSession(
      setup.threadId,
      "Waiting for the other party to open chat once (to register keys)."
    );
  }

  if (setup.hasThreadKeys) {
    return unavailableSession(
      setup.threadId,
      "Secure chat keys exist for this thread but not for this account. Open chat as the assigned doctor, or contact support to reset keys."
    );
  }

  const threadAesKey = await generateThreadAesKey();
  const peerPublic = await importPublicKey(setup.peerPublicKeyJwk);
  const selfPubJwk = await storage.getPublicJwk();
  if (!selfPubJwk) {
    return unavailableSession(
      setup.threadId,
      "Could not load your encryption keys."
    );
  }
  const selfPublic = await importPublicKey(selfPubJwk);
  const envelopes = [
    {
      userId: setup.selfUserId,
      wrappedKeyB64: await wrapThreadKeyForUser(threadAesKey, selfPublic),
    },
    {
      userId: setup.peerUserId,
      wrappedKeyB64: await wrapThreadKeyForUser(threadAesKey, peerPublic),
    },
  ];

  const bootRes = await http("/api/chat/e2ee/thread", {
    method: "POST",
    credentials,
    headers,
    body: JSON.stringify({ threadId: setup.threadId, envelopes }),
  });
  if (!bootRes.ok) {
    return unavailableSession(
      setup.threadId,
      "Could not finish secure chat setup."
    );
  }

  return { threadId: setup.threadId, threadAesKey, ready: true, status: null };
}

export async function encryptOutgoingText(
  plaintext: string,
  session: DoctorThreadE2eeSession | null
): Promise<string> {
  if (!session?.ready || !session.threadAesKey) {
    throw new Error("E2EE_NOT_READY");
  }
  const { iv, ciphertext } = await encryptChatBody(plaintext, session.threadAesKey);
  return packE2eePayload(iv, ciphertext);
}

export async function resetDoctorPatientE2eeEnvelopes(opts: {
  patientId?: string;
  credentials?: RequestCredentials;
  authHeaders?: Record<string, string>;
  fetchFn?: (path: string, init: E2eeFetchInit) => Promise<Response>;
}): Promise<boolean> {
  const http = opts.fetchFn ?? ((path, init) => fetch(path, init));
  return resetDoctorThreadEnvelopes(http, opts);
}

export async function ensureDoctorPatientE2eeReady(opts: {
  patientId?: string;
  credentials?: RequestCredentials;
  storage?: E2eeKeyStorage;
  authHeaders?: Record<string, string>;
  fetchFn?: (path: string, init: E2eeFetchInit) => Promise<Response>;
  maxAttempts?: number;
}): Promise<DoctorThreadE2eeSession | null> {
  const max = opts.maxAttempts ?? 3;
  let last: DoctorThreadE2eeSession | null = null;
  for (let i = 0; i < max; i++) {
    last = await setupDoctorPatientE2ee(opts);
    if (last?.ready) return last;
    if (i < max - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return last;
}

export async function decryptMessages<T extends ChatMessageRow>(
  messages: T[],
  session: DoctorThreadE2eeSession | null
): Promise<T[]> {
  if (!session?.ready || !session.threadAesKey) return messages;
  const key = session.threadAesKey;
  const out: T[] = [];
  for (const m of messages) {
    if (!isE2eePayload(m.text)) {
      out.push(m);
      continue;
    }
    const packed = unpackE2eePayload(m.text);
    if (!packed) {
      out.push({ ...m, text: "🔒 Unable to decrypt" });
      continue;
    }
    try {
      const text = await decryptChatBody(packed.iv, packed.ciphertext, key);
      out.push({ ...m, text });
    } catch {
      out.push({ ...m, text: "🔒 Unable to decrypt" });
    }
  }
  return out;
}
