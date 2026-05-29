import Redis from "ioredis";
import { getRedisUrl } from "../env/index";

const CHANNEL_PREFIX_THREAD = "skinfit:chat:thread:";
const CHANNEL_PREFIX_INBOX = "skinfit:chat:inbox:";

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 });
  }
  return publisher;
}

export type ChatLiveEvent = {
  type: "thread_updated";
  threadId: string;
  at: string;
};

export function chatThreadChannel(threadId: string): string {
  return `${CHANNEL_PREFIX_THREAD}${threadId}`;
}

export function chatInboxChannel(userId: string): string {
  return `${CHANNEL_PREFIX_INBOX}${userId}`;
}

/** Notify SSE clients that a thread has new messages. */
export async function publishChatThreadUpdated(
  threadId: string,
  patientUserId?: string | null
): Promise<void> {
  const event: ChatLiveEvent = {
    type: "thread_updated",
    threadId,
    at: new Date().toISOString(),
  };
  const payload = JSON.stringify(event);
  const pub = getPublisher();
  await pub.publish(chatThreadChannel(threadId), payload);
  if (patientUserId) {
    await pub.publish(chatInboxChannel(patientUserId), payload);
  }
}

/** Dedicated subscriber connection (one per SSE client). */
export function createChatSubscriber(): Redis {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
