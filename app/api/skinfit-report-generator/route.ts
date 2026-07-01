import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  normalizePatientEmail,
  saveClinicExternalReportPdf,
} from "@/src/lib/clinicExternalReports";
import { buildKaiReportContent } from "@/src/lib/sdetectReport/aiReport";
import { buildSdetectReportFromPdf } from "@/src/lib/sdetectReport/buildReport";
import { generateKaiReportPdf } from "@/src/lib/sdetectReport/generateKaiReportPdf";
import {
  defaultOutputBasename,
  sanitizeOutputFilename,
} from "@/src/lib/sdetectReport/outputFilename";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const staffId = await getDoctorPortalUserIdFromRequest(req);
    if (!staffId) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Missing PDF file (field: file)" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return Response.json({ error: "Upload must be a PDF" }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    if (!pdfBuffer.length) {
      return Response.json({ error: "Empty PDF" }, { status: 400 });
    }

    const report = await buildSdetectReportFromPdf(pdfBuffer);
    const content = await buildKaiReportContent(report);
    const eventLabelField = form.get("eventLabel");
    const eventLabel =
      typeof eventLabelField === "string" ? eventLabelField.trim() : "";
    const outPdf = await generateKaiReportPdf(report, content, { eventLabel });
    const fallbackBasename = defaultOutputBasename(file.name);
    const outputNameField = form.get("outputName");
    const outputFilename = sanitizeOutputFilename(
      typeof outputNameField === "string" ? outputNameField : "",
      fallbackBasename
    );

    const emailRaw = form.get("patientEmail");
    const nameRaw = form.get("patientName");
    if (typeof emailRaw !== "string" || !emailRaw.trim()) {
      return Response.json(
        { error: "Patient email is required — the report is saved to Clinic reports automatically." },
        { status: 400 }
      );
    }
    const patientEmail = normalizePatientEmail(emailRaw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      return Response.json({ error: "Invalid patient email" }, { status: 400 });
    }
    const patientName =
      typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
    const title = outputFilename.replace(/\.pdf$/i, "") || "Skin analysis report";

    const saved = await saveClinicExternalReportPdf({
      doctorId: staffId,
      patientEmail,
      patientName,
      title,
      pdfBuffer: Buffer.from(outPdf),
    });

    return new Response(new Uint8Array(outPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
        "X-Output-Filename": outputFilename,
        "X-Clinic-Report-Id": saved.id,
        "X-Clinic-Report-Attached-Pending": saved.attachedToPending ? "1" : "0",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[skinfit-report-generator]", err);
    const message = err instanceof Error ? err.message : "Report generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
