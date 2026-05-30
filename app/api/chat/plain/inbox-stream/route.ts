import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";
import {
  chatInboxChannel,
  createChatSubscriber,
  type ChatLiveEvent,
} from "../../../../../services/shared/src/chat/pubsub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE stream for any doctor/support thread update for this patient (Redis inbox channel).
 * Used by mobile chat home to refresh previews + unread without polling.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get("token");

  let userId = await getSessionUserIdFromRequest(req);
  if (!userId && tokenParam) {
    const secret = getSessionSecret();
    if (secret) {
      try {
        const { sub } = await verifySessionToken(tokenParam, secret);
        userId = sub || null;
      } catch {
        userId = null;
      }
    }
  }
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const channel = chatInboxChannel(userId);
  const subscriber = createChatSubscriber();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", userId });

      const heartbeat = setInterval(() => {
        send({ type: "ping", at: new Date().toISOString() });
      }, 25_000);

      const onMessage = (_ch: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as ChatLiveEvent;
          if (parsed.type === "thread_updated") {
            send({ type: "inbox_updated", threadId: parsed.threadId, at: parsed.at });
          }
        } catch {
          send({ type: "inbox_updated", at: new Date().toISOString() });
        }
      };

      subscriber.on("message", onMessage);

      const close = () => {
        clearInterval(heartbeat);
        subscriber.off("message", onMessage);
        void subscriber.unsubscribe(channel).catch(() => undefined);
        void subscriber.quit();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      void (async () => {
        try {
          await subscriber.subscribe(channel);
        } catch {
          send({ type: "error", message: "subscribe_failed" });
          close();
        }
      })();

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      void subscriber.quit();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
