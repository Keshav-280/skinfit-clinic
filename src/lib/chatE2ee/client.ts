"use client";

/**
 * E2EE client for doctor↔patient chat (browser / React Native with storage adapter).
 */

import {
  decryptChatBody,
  encryptChatBody,
  generateThreadAesKey,
  generateUserKeyPair,
  importPrivateKey,
  importPublicKey,
  unwrapThreadKeyForUser,
  wrapThreadKeyForUser,
} from "@/src/lib/chatE2ee/crypto";
import {
  isE2eePayload,
  packE2eePayload,
  unpackE2eePayload,
} from "@/src/lib/chatE2ee/format";
import { type E2eeKeyStorage, webE2eeKeyStorage } from "@/src/lib/chatE2ee/keyStorage";

export type { E2eeKeyStorage } from "@/src/lib/chatE2ee/keyStorage";
export { webE2eeKeyStorage, asyncStorageE2eeAdapter } from "@/src/lib/chatE2ee/keyStorage";

export type ChatMessageRow = {
  id: string;
  sender: string;
  text: string;
  attachmentUrl?: string | null;
  createdAt?: string;
};

export type DoctorThreadE2eeSession = {
  threadId: string;
  threadAesKey: CryptoKey;
  ready: boolean;
  status: string | null;
};

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

export async function setupDoctorPatientE2ee(opts: {
  patientId?: string;
  credentials?: RequestCredentials;
  storage?: E2eeKeyStorage;
  authHeaders?: Record<string, string>;
  /** Resolve API path (e.g. mobile passes `apiUrl`). Defaults to same-origin `/api/...`. */
  fetchFn?: (path: string, init: E2eeFetchInit) => Promise<Response>;
}): Promise<DoctorThreadE2eeSession | null> {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    return {
      threadId: "",
      threadAesKey: await generateThreadAesKey(),
      ready: false,
      status: "Secure chat is not supported on this device.",
    };
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
      if (!res.ok) throw new Error("KEY_REGISTER_FAILED");
    });
  } catch {
    return {
      threadId: "",
      threadAesKey: await generateThreadAesKey(),
      ready: false,
      status: "Could not register encryption keys.",
    };
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
    ready?: boolean;
    peerHasPublicKey?: boolean;
  };

  if (!setupRes.ok || !setup.ok || !setup.threadId || !setup.selfUserId) {
    return {
      threadId: setup.threadId ?? "",
      threadAesKey: await generateThreadAesKey(),
      ready: false,
      status: "Could not load secure chat setup.",
    };
  }

  if (setup.ready && setup.wrappedThreadKeyB64) {
    const threadAesKey = await unwrapThreadKeyForUser(
      setup.wrappedThreadKeyB64,
      privateKey
    );
    return { threadId: setup.threadId, threadAesKey, ready: true, status: null };
  }

  if (!setup.peerHasPublicKey || !setup.peerPublicKeyJwk || !setup.peerUserId) {
    return {
      threadId: setup.threadId,
      threadAesKey: await generateThreadAesKey(),
      ready: false,
      status: "Waiting for the other party to open chat once (to register keys).",
    };
  }

  const threadAesKey = await generateThreadAesKey();
  const peerPublic = await importPublicKey(setup.peerPublicKeyJwk);
  const selfPubJwk = await storage.getPublicJwk();
  if (!selfPubJwk) {
    return {
      threadId: setup.threadId,
      threadAesKey,
      ready: false,
      status: "Could not load your encryption keys.",
    };
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
    return {
      threadId: setup.threadId,
      threadAesKey,
      ready: false,
      status: "Could not finish secure chat setup.",
    };
  }

  return { threadId: setup.threadId, threadAesKey, ready: true, status: null };
}

export async function encryptOutgoingText(
  plaintext: string,
  session: DoctorThreadE2eeSession | null
): Promise<string> {
  if (!session?.ready) return plaintext;
  const { iv, ciphertext } = await encryptChatBody(plaintext, session.threadAesKey);
  return packE2eePayload(iv, ciphertext);
}

export async function decryptMessages<T extends ChatMessageRow>(
  messages: T[],
  session: DoctorThreadE2eeSession | null
): Promise<T[]> {
  if (!session?.ready) return messages;
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
      const text = await decryptChatBody(
        packed.iv,
        packed.ciphertext,
        session.threadAesKey
      );
      out.push({ ...m, text });
    } catch {
      out.push({ ...m, text: "🔒 Unable to decrypt" });
    }
  }
  return out;
}
