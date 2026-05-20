import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import {
  countUnreadClinicMessagesForAssistant,
  parseInboxSinceParams,
} from "@/src/lib/chatInboxUnread";
import { getUnreadVoiceNoteBreakdown } from "@/src/lib/voiceNoteInboxUnread";

const MAX_BADGE = 99;

function isMissingColumnOrTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  if (err?.code === "42703" || err?.code === "42P01") return true;
  const msg = err?.message ?? "";
  return /patient_cleared_chat_at|doctor_feedback_voice_notes|chat_messages|chat_threads/i.test(
    msg
  );
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const { supportSince, doctorSince } = parseInboxSinceParams(url);

  let supportRaw = 0;
  let doctorRaw = 0;
  let voiceBreakdown = { general: 0, report: 0, total: 0 };
  try {
    [supportRaw, doctorRaw, voiceBreakdown] = await Promise.all([
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
      getUnreadVoiceNoteBreakdown(userId),
    ]);
  } catch (e) {
    if (!isMissingColumnOrTable(e)) throw e;
    console.warn("[chat/inbox/unread] missing chat schema columns/tables; returning 0");
  }

  const supportCount = Math.min(supportRaw, MAX_BADGE);
  const doctorCount = Math.min(doctorRaw, MAX_BADGE);
  const voiceNoteCount = Math.min(voiceBreakdown.total, MAX_BADGE);
  const voiceNoteGeneralCount = Math.min(voiceBreakdown.general, MAX_BADGE);
  const voiceNoteReportCount = Math.min(voiceBreakdown.report, MAX_BADGE);
  const chatTotal = supportRaw + doctorRaw;
  const total = Math.min(chatTotal + voiceBreakdown.total, MAX_BADGE);

  return NextResponse.json({
    success: true,
    supportCount,
    doctorCount,
    voiceNoteCount,
    voiceNoteGeneralCount,
    voiceNoteReportCount,
    total,
    supportHasMore: supportRaw > MAX_BADGE,
    doctorHasMore: doctorRaw > MAX_BADGE,
    hasMore: chatTotal + voiceBreakdown.total > MAX_BADGE,
  });
}
