import { getDoctorPortalUserIdFromRequest } from "@/src/lib/auth/doctor-access";
import { buildSdetectReportFromPdf } from "@/src/lib/sdetectReport/buildReport";
import { generateSkinfitReportPdf } from "@/src/lib/sdetectReport/generateSkinfitReportPdf";
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
    const outPdf = await generateSkinfitReportPdf(report);
    const fallbackBasename = defaultOutputBasename(file.name);
    const outputNameField = form.get("outputName");
    const outputFilename = sanitizeOutputFilename(
      typeof outputNameField === "string" ? outputNameField : "",
      fallbackBasename
    );

    return new Response(new Uint8Array(outPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
        "X-Output-Filename": outputFilename,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Report generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
