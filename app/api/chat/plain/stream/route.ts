import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { chatThreads } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { getSessionSecret } from "@/src/lib/auth/session-secret";
import { verifySessionToken } from "@/src/lib/auth/session";
import { resolvePatientDoctorThread } from "@/src/lib/patientDoctorChatThread";
import {
  chatThreadChannel,
  createChatSubscriber,
  type ChatLiveEvent,
} from "../../../../../services/shared/src/chat/pubsub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveThreadId(
  userId: string,
  assistantId: "doctor" | "support" | "ai",
  doctorIdParam: string | null
): Promise<string | null> {
  if (assistantId === "ai") return null;

  if (assistantId === "doctor") {
    const resolved = await resolvePatientDoctorThread(userId, doctorIdParam);
    return resolved?.threadId ?? null;
  }

  const [row] = await db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(
      and(eq(chatThreads.userId, userId), eq(chatThreads.assistantId, assistantId))
    )
    .orderBy(desc(chatThreads.createdAt))
    .limit(1);

  return row?.id ?? null;
}

/**
 * SSE stream for live doctor/support chat updates (Redis pub/sub).
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

  const assistantId = url.searchParams.get("assistantId");
  if (assistantId !== "doctor" && assistantId !== "support") {
    return new Response("Invalid assistantId", { status: 400 });
  }

  const doctorIdParam =
    assistantId === "doctor" ? url.searchParams.get("doctorId") : null;

  const threadId = await resolveThreadId(userId, assistantId, doctorIdParam);
  if (!threadId) {
    return new Response("No thread", { status: 404 });
  }

  const channel = chatThreadChannel(threadId);
  const subscriber = createChatSubscriber();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      send({ type: "connected", threadId });

      const heartbeat = setInterval(() => {
        send({ type: "ping", at: new Date().toISOString() });
      }, 25_000);

      const onMessage = (_ch: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as ChatLiveEvent;
          if (parsed.type === "thread_updated") {
            send(parsed);
          }
        } catch {
          send({ type: "thread_updated", threadId, at: new Date().toISOString() });
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
