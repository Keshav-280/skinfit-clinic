import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  countUnreadClinicMessagesForAssistant,
  parseInboxSinceParams,
} from "@/src/lib/chatInboxUnread";

const MAX_BADGE = 99;

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const { supportSince, doctorSince } = parseInboxSinceParams(url);

  const [supportRaw, doctorRaw] = await Promise.all([
    countUnreadClinicMessagesForAssistant({
      userId,
      assistantId: "support",
      since: supportSince,
    }),
    countUnreadClinicMessagesForAssistant({
      userId,
      assistantId: "doctor",
      since: doctorSince,
    }),
  ]);

  const supportCount = Math.min(supportRaw, MAX_BADGE);
  const doctorCount = Math.min(doctorRaw, MAX_BADGE);
  const total = Math.min(supportRaw + doctorRaw, MAX_BADGE);

  return NextResponse.json({
    success: true,
    supportCount,
    doctorCount,
    total,
    supportHasMore: supportRaw > MAX_BADGE,
    doctorHasMore: doctorRaw > MAX_BADGE,
    hasMore: supportRaw + doctorRaw > MAX_BADGE,
  });
}
