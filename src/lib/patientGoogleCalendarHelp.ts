import { doctorDisplayName } from "@/src/lib/doctorDisplayName";
import { ymdHmStringsToUtcInstant } from "@/src/lib/clinicSlotUtcInstant";
import {
  DEFAULT_SLOT_DURATION_MINUTES,
  effectiveSlotEndHm,
  formatSlotTimeRange,
} from "@/src/lib/slotTimeHm";

/** Google Calendar `dates` param: UTC `YYYYMMDDTHHmmssZ`. */
function toGoogleCalendarUtcSegment(d: Date): string {
  const iso = d.toISOString();
  const noMs = iso.replace(/\.\d{3}Z$/, "Z");
  return noMs.replace(/[-:]/g, "");
}

/**
 * Opens Google Calendar “create event” with title, time range, and details.
 * Patient signs in to Google and taps Save.
 */
export function buildGoogleCalendarTemplateUrl(params: {
  title: string;
  startUtc: Date;
  endUtc: Date;
  details?: string;
}): string {
  const dates = `${toGoogleCalendarUtcSegment(params.startUtc)}/${toGoogleCalendarUtcSegment(params.endUtc)}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: params.title,
    dates,
  });
  if (params.details?.trim()) {
    q.set("details", params.details.trim());
  }
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function confirmationCalendarAppendixMarkdown(params: {
  addToCalendarUrl: string;
  slotYmd: string;
  timeRangeLabel: string;
}): string {
  return `\n\n[**Add to Google Calendar**](${params.addToCalendarUrl})\n\n1. Open the link above (sign in with Google if prompted).\n2. Check the start and end time, then tap **Save**.\n\n_You can also open the Google Calendar app and create an event manually for **${params.slotYmd}** at **${params.timeRangeLabel}**._`;
}

/**
 * Full Clinic Support message when a visit is confirmed (markdown; rendered in chat).
 */
export function formatPatientAppointmentConfirmationMessage(params: {
  dateTimeUtc: Date;
  slotYmd: string;
  slotTimeHm: string;
  slotEndTimeHm?: string | null;
  doctorNameRaw?: string | null;
}): string {
  const dr = doctorDisplayName(params.doctorNameRaw);
  const title = `SkinFit Wellness - ${dr}`;
  const endHm = effectiveSlotEndHm(params.slotTimeHm, params.slotEndTimeHm);
  const endUtc =
    ymdHmStringsToUtcInstant(params.slotYmd, endHm) ??
    new Date(
      params.dateTimeUtc.getTime() + DEFAULT_SLOT_DURATION_MINUTES * 60 * 1000
    );
  const timeRangeLabel = formatSlotTimeRange(
    params.slotTimeHm,
    params.slotEndTimeHm
  );
  const details = `SkinFit Wellness visit on ${params.slotYmd}, ${timeRangeLabel}.`;
  const addToCalendarUrl = buildGoogleCalendarTemplateUrl({
    title,
    startUtc: params.dateTimeUtc,
    endUtc,
    details,
  });

  const timePhrase = timeRangeLabel.includes(" - ")
    ? `from **${timeRangeLabel}**`
    : `at **${timeRangeLabel}**`;
  const base = `Your appointment on **${params.slotYmd}** ${timePhrase} is confirmed. We look forward to seeing you.`;
  return (
    base +
    confirmationCalendarAppendixMarkdown({
      addToCalendarUrl,
      slotYmd: params.slotYmd,
      timeRangeLabel,
    })
  );
}
