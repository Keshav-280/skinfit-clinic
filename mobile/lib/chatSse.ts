import { apiFetch } from "@/lib/api";

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
  const blocks = buffer.split("\n\n");
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

/**
 * Long-lived SSE reader for React Native (fetch + ReadableStream).
 * Uses Authorization Bearer; falls back via `onUnavailable` when streaming is unsupported.
 */
export function connectChatSseStream(options: ConnectChatSseOptions): () => void {
  const ac = new AbortController();
  let closed = false;

  void (async () => {
    try {
      const res = await apiFetch(options.path, options.token, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: ac.signal,
      });

      if (!res.ok) {
        options.onUnavailable?.();
        return;
      }

      const body = res.body;
      if (!body || typeof body.getReader !== "function") {
        options.onUnavailable?.();
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(buffer);
        buffer = parsed.rest;
        for (const ev of parsed.events) {
          options.onEvent(ev);
        }
      }

      if (!closed) options.onUnavailable?.();
    } catch (e) {
      if (!closed && !ac.signal.aborted) {
        if (__DEV__ && e instanceof Error) {
          console.warn("[chatSse] stream ended:", e.message);
        }
        options.onUnavailable?.();
      }
    }
  })();

  return () => {
    closed = true;
    ac.abort();
  };
}
