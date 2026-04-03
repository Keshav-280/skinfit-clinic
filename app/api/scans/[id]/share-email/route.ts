import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { scans, users } from "@/src/db/schema";
import { getSessionUserIdFromRequest } from "@/src/lib/auth/get-session";
import { escapeHtml } from "@/src/lib/email/markdownToEmailPlain";
import {
  getClinicNotificationEmail,
  isSmtpConfigured,
  sendSmtpMessage,
} from "@/src/lib/email/smtpMail";
import { readWebFormData, type WebFormData } from "@/src/lib/webRequestFormData";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "EMAIL_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const userId = await getSessionUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id: idParam } = await params;
  const scanId = Number.parseInt(idParam, 10);
  if (!Number.isFinite(scanId) || scanId < 1) {
    return NextResponse.json({ error: "INVALID_SCAN_ID" }, { status: 400 });
  }

  const owned = await db.query.scans.findFirst({
    where: and(eq(scans.id, scanId), eq(scans.userId, userId)),
    columns: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  let form: WebFormData;
  try {
    form = await readWebFormData(req);
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 });
  }

  const toRaw = form.get("toEmail");
  const file = form.get("file");
  if (typeof toRaw !== "string" || !isValidEmail(toRaw)) {
    return NextResponse.json({ error: "INVALID_TO_EMAIL" }, { status: 400 });
  }
  const toEmail = toRaw.trim();

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "PDF_REQUIRED" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF_TOO_LARGE" }, { status: 413 });
  }

  const ab = await file.arrayBuffer();
  const base64 = Buffer.from(ab).toString("base64");
  const filename =
    typeof form.get("filename") === "string" && form.get("filename")
      ? String(form.get("filename")).replace(/[/\\]/g, "_").slice(0, 200)
      : `ai-scan-report-${scanId}.pdf`;

  const [u] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const who = u?.name?.trim() || "A patient";
  const subject = "Your SkinnFit AI skin scan report";
  const text = `${who} shared their AI skin scan report with you.\n\nThe report is attached as a PDF.\n\n— SkinnFit Clinic`;
  const html = `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">${escapeHtml(who)} shared their AI skin scan report with you.</p><p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#18181b">The report is attached as a PDF.</p><p style="font-family:system-ui,sans-serif;font-size:14px;color:#71717a">— SkinnFit Clinic</p>`;

  const clinic = getClinicNotificationEmail();
  const bcc =
    clinic && clinic.toLowerCase() !== toEmail.toLowerCase() ? clinic : undefined;

  try {
    await sendSmtpMessage({
      to: toEmail,
      bcc,
      subject,
      text,
      html,
      attachments: [
        {
          content: base64,
          filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });
  } catch (e) {
    console.error("scans/share-email", scanId, e);
    return NextResponse.json({ error: "SEND_FAILED" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
