import { formatSlotTimeRange } from "@/src/lib/slotTimeHm";

/**
 * Patient-facing Clinic Support chat copy when the clinic cancels or declines
 * an appointment request or revokes a confirmed booking.
 * Google Calendar removal hints are only appended when a **confirmed** visit is
 * cancelled (patient may have added the event). Declined pending requests do not
 * include that block.
 */
export type ClinicCancellationKind = "confirmed_visit" | "pending_request";

/** Escape `*` / `_` so patient-facing reason text does not break Markdown bold. */
function escapeMarkdownInline(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_");
}

/** Opens Google Calendar web on that local calendar day (user deletes the event there). */
function googleCalendarDayViewUrlFromYmd(ymd: string | null): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, mo, da] = ymd.split("-").map(Number);
  if (!y || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `https://calendar.google.com/calendar/u/0/r/day/${y}/${mo}/${da}`;
}

/** Only for a cancelled *confirmed* visit (patient may have used “Add to Google Calendar”). */
function googleCalendarRemovalHintForConfirmedVisitMarkdown(
  slotYmd: string | null
): string {
  const dayUrl = googleCalendarDayViewUrlFromYmd(slotYmd);
  const openDay =
    dayUrl && slotYmd
      ? `1. [**Open this day in Google Calendar**](${dayUrl}) — goes to **${slotYmd}** so you can spot the visit fast.\n2. Open the event (often **SkinnFit Clinic** or your doctor’s name), then tap **Delete** / trash or **Remove** so you won’t get reminders.\n\n`
      : `1. Open [Google Calendar](https://calendar.google.com) (same Google account you used for **Add to Google Calendar**, if applicable).\n2. Find the event for this visit and **delete** or **remove** it.\n\n`;

  return `\n\n**Remove from Google Calendar (if you added it)**\n\n${openDay}[Google Calendar home](https://calendar.google.com) · On the phone app, open Calendar and delete the event for that day.`;
}

export function clinicCancellationChatMessage(params: {
  kind: ClinicCancellationKind;
  slotYmd: string | null;
  slotTimeHm: string | null;
  /** Optional; when null, range uses start + 30 min for display. */
  slotEndTimeHm?: string | null;
  reason: string;
}): string {
  const reason = params.reason.trim() || "No details provided.";
  const reasonMd = escapeMarkdownInline(reason);
  const whenPart =
    params.slotYmd && params.slotTimeHm
      ? ` on **${params.slotYmd} at ${formatSlotTimeRange(params.slotTimeHm, params.slotEndTimeHm)}**`
      : "";

  if (params.kind === "confirmed_visit") {
    return (
      `Your confirmed appointment${whenPart} has been **cancelled** by the clinic. **Reason:** **${reasonMd}** We're sorry for the inconvenience. You can choose another available time under Schedules → Doctor calendar when it works for you.` +
      googleCalendarRemovalHintForConfirmedVisitMarkdown(params.slotYmd)
    );
  }

  // Declined pending request — patient typically has not added a calendar event yet.
  return `Your appointment request${whenPart} was not approved (**cancelled** by the clinic). **Reason:** **${reasonMd}** You can submit a new request for a different open slot anytime.`;
}

export function clinicCancellationKindFromRequestRow(row: {
  status: string;
  appointmentId: string | null;
}): ClinicCancellationKind {
  if (row.appointmentId || row.status === "approved") {
    return "confirmed_visit";
  }
  return "pending_request";
}
