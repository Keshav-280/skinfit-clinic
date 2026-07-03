import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import {
  normalizePatientEmail,
  saveClinicExternalReportPdf,
} from "@/src/lib/clinicExternalReports";
import { KAI_REPORT_EVENT_LABEL } from "@/src/lib/sdetectReport/eventLabel";
import { buildKaiReportContent } from "@/src/lib/sdetectReport/aiReport";
import { buildSdetectReportFromPdf } from "@/src/lib/sdetectReport/buildReport";
import { generateKaiReportPdf } from "@/src/lib/sdetectReport/generateKaiReportPdf";
import { reportError, reportLog } from "@/src/lib/sdetectReport/pipelineLog";
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

    const eventLabelField = form.get("eventLabel");
    const eventLabel =
      typeof eventLabelField === "string" && eventLabelField.trim()
        ? eventLabelField.trim()
        : KAI_REPORT_EVENT_LABEL;

    reportLog("upload_received", {
      filename: file.name,
      bytes: pdfBuffer.length,
      eventLabel,
      doctorId: staffId,
    });

    const report = await buildSdetectReportFromPdf(pdfBuffer, { sourceFilename: file.name });
    const content = await buildKaiReportContent(report, { eventLabel });
    const outPdf = await generateKaiReportPdf(report, content, { eventLabel });
    const fallbackBasename = defaultOutputBasename(file.name);
    const outputNameField = form.get("outputName");
    const outputFilename = sanitizeOutputFilename(
      typeof outputNameField === "string" ? outputNameField : "",
      fallbackBasename
    );

    const emailRaw = form.get("patientEmail");
    const nameRaw = form.get("patientName");
    if (typeof nameRaw !== "string" || !nameRaw.trim()) {
      return Response.json({ error: "Patient name is required" }, { status: 400 });
    }
    const patientName = nameRaw.trim().slice(0, 255);
    const title = outputFilename.replace(/\.pdf$/i, "") || "Skin analysis report";

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${outputFilename}"`,
      "X-Output-Filename": outputFilename,
      "Cache-Control": "no-store",
    };

    let patientEmail: string | null = null;
    if (typeof emailRaw === "string" && emailRaw.trim()) {
      const normalized = normalizePatientEmail(emailRaw);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return Response.json({ error: "Invalid patient email" }, { status: 400 });
      }
      patientEmail = normalized;
    }

    const saved = await saveClinicExternalReportPdf({
      doctorId: staffId,
      patientName,
      patientEmail,
      title,
      pdfBuffer: Buffer.from(outPdf),
    });

    headers["X-Clinic-Report-Saved"] = "1";
    headers["X-Clinic-Report-Id"] = saved.id;
    headers["X-Clinic-Report-Attached-Pending"] = saved.attachedToPending ? "1" : "0";

    reportLog("generate_complete", {
      outputFilename,
      outputBytes: outPdf.length,
      clinicReportId: saved.id,
      patientName,
      observationScores: content.observations.map((o) => o.score),
    });

    return new Response(new Uint8Array(outPdf), {
      status: 200,
      headers,
    });
  } catch (err) {
    reportError("generate_failed", err);
    const message = err instanceof Error ? err.message : "Report generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
