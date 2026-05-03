import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { patientScheduleRequests, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { notifyDoctorsNewScheduleRequest } from "@/src/lib/clinicSheetAppointmentWebhook";
import { getDefaultClinicDoctorId } from "@/src/lib/defaultClinicDoctor";
import { dateOnlyFromYmd, ymdFromDateOnly } from "@/src/lib/date-only";
import { postGoogleAppsScriptWebAppJson } from "@/src/lib/googleAppsScriptWebAppFetch";
import { publicAppOriginFromRequest } from "@/src/lib/publicAppOrigin";

function formatPatientPhoneForCrm(
  countryCode: string | null | undefined,
  national: string | null | undefined
): string | null {
  const n = national?.trim();
  if (!n) return null;
  const cc = (countryCode ?? "+91").trim() || "+91";
  return `${cc} ${n}`.trim();
}

function isYmd(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Parsed JSON body from Google Apps Script sheet relay (best-effort). */
type SheetRelayJson = {
  ok?: unknown;
  error?: unknown;
  message?: unknown;
  externalRef?: unknown;
};

function parseSheetRelayJson(text: string): SheetRelayJson | null {
  if (!text.trim().startsWith("{")) return null;
  try {
    return JSON.parse(text) as SheetRelayJson;
  } catch {
    return null;
  }
}

function normalizeAttachments(
  input: unknown
): Array<{ fileName: string; mimeType: string; dataUri: string }> | "INVALID" {
  if (!Array.isArray(input)) return [];
  const out: Array<{ fileName: string; mimeType: string; dataUri: string }> = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return "INVALID";
    const x = item as Record<string, unknown>;
    const fileName = typeof x.fileName === "string" ? x.fileName.trim() : "";
    const mimeType = typeof x.mimeType === "string" ? x.mimeType.trim() : "";
    const dataUri = typeof x.dataUri === "string" ? x.dataUri.trim() : "";
    if (!fileName || !mimeType || !dataUri) return "INVALID";
    if (!mimeType.startsWith("image/")) return "INVALID";
    if (!dataUri.startsWith("data:image/")) return "INVALID";
    if (dataUri.length > 3_200_000) return "INVALID";
    out.push({ fileName, mimeType, dataUri });
    if (out.length > 4) return "INVALID";
  }
  return out;
}

export async function GET(req: Request) {
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rows = await db.query.patientScheduleRequests.findMany({
    where: eq(patientScheduleRequests.patientId, userId),
    orderBy: [desc(patientScheduleRequests.createdAt)],
    limit: 40,
  });

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      preferredDateYmd: ymdFromDateOnly(r.preferredDate),
      issue: r.issue,
      daysAffected: r.daysAffected,
      timePreferences: r.timePreferences,
      attachments: r.attachments ?? [],
      status: r.status,
      externalRef: r.externalRef,
      cancelledReason: r.cancelledReason,
      crmPatientMessage: r.crmPatientMessage ?? null,
      appointmentId: r.appointmentId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const appOrigin = publicAppOriginFromRequest(req);
  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const b = body as {
    preferredDateYmd?: unknown;
    issue?: unknown;
    daysAffected?: unknown;
    timePreferences?: unknown;
    attachments?: unknown;
    doctorId?: unknown;
  };

  const preferredDateYmd =
    typeof b.preferredDateYmd === "string" ? b.preferredDateYmd.trim() : "";
  const timePreferences =
    typeof b.timePreferences === "string" ? b.timePreferences.trim() : "";
  const issue = typeof b.issue === "string" ? b.issue.trim() : "";
  const daysAffectedNum =
    typeof b.daysAffected === "number" && Number.isFinite(b.daysAffected)
      ? Math.max(0, Math.min(3650, Math.round(b.daysAffected)))
      : null;
  const attachments = normalizeAttachments(b.attachments);
  const doctorIdRaw =
    typeof b.doctorId === "string" ? b.doctorId.trim() : "";

  if (!isYmd(preferredDateYmd)) {
    return NextResponse.json({ error: "INVALID_PREFERRED_DATE" }, { status: 400 });
  }
  if (timePreferences.length < 2) {
    return NextResponse.json(
      { error: "TIME_PREFERENCES_REQUIRED" },
      { status: 400 }
    );
  }
  if (attachments === "INVALID") {
    return NextResponse.json({ error: "INVALID_ATTACHMENTS" }, { status: 400 });
  }
  if (issue.length < 2) {
    return NextResponse.json({ error: "ISSUE_REQUIRED" }, { status: 400 });
  }

  let doctorId: string | null = null;
  if (doctorIdRaw) {
    const doc = await db.query.users.findFirst({
      where: eq(users.id, doctorIdRaw),
      columns: { id: true, role: true },
    });
    if (doc && (doc.role === "doctor" || doc.role === "admin")) {
      doctorId = doc.id;
    }
  }
  if (!doctorId) {
    doctorId = await getDefaultClinicDoctorId();
  }

  const [patient] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneCountryCode: users.phoneCountryCode,
      timezone: users.timezone,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const preferredDate = dateOnlyFromYmd(preferredDateYmd);

  const [row] = await db
    .insert(patientScheduleRequests)
    .values({
      patientId: userId,
      doctorId,
      preferredDate,
      issue,
      daysAffected: daysAffectedNum,
      timePreferences,
      attachments,
      status: "pending",
    })
    .returning({ id: patientScheduleRequests.id });

  if (!row) {
    return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
  }

  const patientName = patient?.name?.trim() || patient?.email || "Patient";
  const patientPhone = formatPatientPhoneForCrm(
    patient?.phoneCountryCode,
    patient?.phone
  );
  const patientTimezone = patient?.timezone?.trim() || null;
  const attachmentFileNames = attachments.map((a) => a.fileName);
  const schedulesPath = "/dashboard/schedules";
  const patientSchedulesUrl = appOrigin ? `${appOrigin}${schedulesPath}` : null;
  const appointmentSyncUrl = appOrigin
    ? `${appOrigin}/api/integrations/clinic-sheet/appointments`
    : null;

  void notifyDoctorsNewScheduleRequest({
    patientName,
    preferredDateYmd,
    preview: `${issue} · ${timePreferences}`,
  });

  const outboundUrlRaw = process.env.CLINIC_SHEET_REQUEST_WEBHOOK_URL?.trim();
  const outboundSecret = process.env.CLINIC_SHEET_WEBHOOK_SECRET?.trim();
  let sheetRelayOk = false;
  let sheetRelayMessage: string | null = null;
  let sheetRelayOmittedImages = false;
  if (outboundUrlRaw && outboundSecret) {
    try {
      const outbound = new URL(outboundUrlRaw);
      // Apps Script commonly validates `?secret=...`; keep header too.
      if (!outbound.searchParams.get("secret")) {
        outbound.searchParams.set("secret", outboundSecret);
      }
      const relayPayload = {
        kind: "patient_schedule_request" as const,
        sheetPayloadVersion: 2,
        requestId: row.id,
        patientId: userId,
        patientName,
        patientEmail: patient?.email ?? null,
        patientPhone,
        patientTimezone,
        doctorId,
        preferredDateYmd,
        /** Same as preferredDateYmd; alias for sheets that label the column Ym. */
        preferredDateYm: preferredDateYmd,
        issue,
        daysAffected: daysAffectedNum,
        timePreferences,
        attachmentsCount: attachments.length,
        attachmentFileNames,
        attachmentFileNamesCsv: attachmentFileNames.join("; "),
        attachments: attachments.map((a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          dataUri: a.dataUri,
        })),
        status: "pending" as const,
        source: "skinfit_web",
        createdAt: new Date().toISOString(),
        patientSchedulesUrl,
        appointmentSyncUrl,
      };

      /** Google Apps Script often 500s on huge JSON (multi-image base64). */
      const MAX_SHEET_RELAY_BODY_CHARS = 2_400_000;
      let relayBodyPayload: typeof relayPayload = relayPayload;
      let relayBodyStr = JSON.stringify(relayPayload);
      if (relayBodyStr.length > MAX_SHEET_RELAY_BODY_CHARS) {
        relayBodyPayload = { ...relayPayload, attachments: [] };
        relayBodyStr = JSON.stringify(relayBodyPayload);
        sheetRelayOmittedImages = true;
      }

      let relayRes = await postGoogleAppsScriptWebAppJson(
        outbound.toString(),
        outboundSecret,
        relayBodyStr
      );
      let relayBodyText = await relayRes.text().catch(() => "");
      let relayJson = parseSheetRelayJson(relayBodyText);

      if (
        !relayRes.ok &&
        relayPayload.attachments.length > 0 &&
        relayBodyPayload.attachments.length > 0
      ) {
        sheetRelayOmittedImages = true;
        relayBodyPayload = { ...relayPayload, attachments: [] };
        relayBodyStr = JSON.stringify(relayBodyPayload);
        relayRes = await postGoogleAppsScriptWebAppJson(
          outbound.toString(),
          outboundSecret,
          relayBodyStr
        );
        relayBodyText = await relayRes.text().catch(() => "");
        relayJson = parseSheetRelayJson(relayBodyText);
      }

      if (relayRes.ok && relayJson !== null && relayJson.ok === false) {
        sheetRelayOk = false;
        const msg =
          (typeof relayJson.message === "string" && relayJson.message.trim()) ||
          (typeof relayJson.error === "string" && relayJson.error.trim()) ||
          "sheet relay rejected";
        sheetRelayMessage = msg;
      } else if (relayRes.ok) {
        sheetRelayOk = true;
        try {
          const ref =
            relayJson &&
            typeof relayJson.externalRef === "string"
              ? relayJson.externalRef.trim()
              : "";
          if (ref && ref.length <= 500) {
            await db
              .update(patientScheduleRequests)
              .set({
                externalRef: ref,
                updatedAt: new Date(),
              })
              .where(eq(patientScheduleRequests.id, row.id));
          }
        } catch {
          /* ignore */
        }
      } else {
        sheetRelayOk = false;
        const snippet = relayBodyText.replace(/\s+/g, " ").trim().slice(0, 280);
        sheetRelayMessage = `sheet relay failed (${relayRes.status})${snippet ? `: ${snippet}` : ""}`;
      }
    } catch (e) {
      sheetRelayMessage =
        e instanceof Error ? e.message : "sheet relay failed";
    }
  } else {
    sheetRelayMessage = "sheet relay skipped: missing webhook env";
  }

  const formUrl = process.env.NEXT_PUBLIC_CLINIC_APPOINTMENT_FORM_URL?.trim();

  return NextResponse.json({
    success: true,
    id: row.id,
    clinicAppointmentFormUrl: formUrl || null,
    sheetRelayOk,
    sheetRelayMessage,
    sheetRelayOmittedImages,
  });
}
