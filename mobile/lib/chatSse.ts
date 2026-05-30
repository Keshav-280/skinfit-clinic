import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import { apiUrl } from "@/lib/apiBase";

export type ChatSsePayload = {
  type?: string;
  threadId?: string;
  at?: string;
  message?: string;
};

type ConnectChatSseOptions = {
  /** Path only, e.g. `/api/chat/plain/stream?assistantId=doctor` */
  path: string;
  token: string;
  onEvent: (payload: ChatSsePayload) => void;
  /** Stream unsupported or connection failed — caller should fall back to polling. */
  onUnavailable?: () => void;
};

function parseSseBuffer(buffer: string): { events: ChatSsePayload[]; rest: string } {
  const events: ChatSsePayload[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        events.push(JSON.parse(raw) as ChatSsePayload);
      } catch {
        events.push({ type: "thread_updated" });
      }
    }
  }
  return { events, rest };
}

function ingestSseChunk(
  buffer: string,
  chunk: string,
  onEvent: (payload: ChatSsePayload) => void
): string {
  const next = buffer + chunk;
  const parsed = parseSseBuffer(next);
  for (const ev of parsed.events) {
    onEvent(ev);
  }
  return parsed.rest;
}

/** React Native: fetch streaming often buffers until close — XHR onprogress gets chunks live. */
function connectXhrSseStream(
  options: ConnectChatSseOptions,
  isClosed: () => boolean
): () => void {
  const xhr = new XMLHttpRequest();
  let buffer = "";
  let lastIndex = 0;
  let notifiedUnavailable = false;

  const notifyUnavailable = () => {
    if (notifiedUnavailable || isClosed()) return;
    notifiedUnavailable = true;
    options.onUnavailable?.();
  };

  xhr.open("GET", apiUrl(options.path));
  xhr.setRequestHeader("Authorization", `Bearer ${options.token}`);
  xhr.setRequestHeader("Accept", "text/event-stream");

  xhr.onprogress = () => {
    if (isClosed()) return;
    const chunk = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    if (!chunk) return;
    buffer = ingestSseChunk(buffer, chunk, options.onEvent);
  };

  xhr.onload = () => {
    if (isClosed()) return;
    const chunk = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    if (chunk) {
      buffer = ingestSseChunk(buffer, chunk, options.onEvent);
    }
    notifyUnavailable();
  };

  xhr.onerror = () => notifyUnavailable();
  xhr.onabort = () => {
    /* intentional teardown */
  };
  xhr.ontimeout = () => notifyUnavailable();

  xhr.send();

  return () => {
    xhr.abort();
  };
}

function connectFetchSseStream(
  options: ConnectChatSseOptions,
  signal: AbortSignal,
  isClosed: () => boolean
): () => void {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  void (async () => {
    try {
      const res = await apiFetch(options.path, options.token, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal,
      });

      if (!res.ok || isClosed()) {
        options.onUnavailable?.();
        return;
      }

      const body = res.body;
      if (!body || typeof body.getReader !== "function") {
        options.onUnavailable?.();
        return;
      }

      reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!isClosed()) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer = ingestSseChunk(buffer, decoder.decode(value, { stream: true }), options.onEvent);
      }

      if (!isClosed()) options.onUnavailable?.();
    } catch (e) {
      if (!isClosed() && !signal.aborted) {
        if (__DEV__ && e instanceof Error) {
          console.warn("[chatSse] stream ended:", e.message);
        }
        options.onUnavailable?.();
      }
    }
  })();

  return () => {
    void reader?.cancel().catch(() => undefined);
  };
}

/**
 * Long-lived SSE reader. Native uses XHR incremental parse; web uses fetch stream.
 */
export function connectChatSseStream(options: ConnectChatSseOptions): () => void {
  const ac = new AbortController();
  let closed = false;
  const isClosed = () => closed;

  const stopInner =
    Platform.OS === "web"
      ? connectFetchSseStream(options, ac.signal, isClosed)
      : connectXhrSseStream(options, isClosed);

  return () => {
    closed = true;
    ac.abort();
    stopInner();
  };
}
