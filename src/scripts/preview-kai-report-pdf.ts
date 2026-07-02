import { readFileSync, writeFileSync } from "node:fs";
import { KAI_REPORT_EVENT_LABEL } from "../lib/sdetectReport/eventLabel";
import { buildKaiReportContent } from "../lib/sdetectReport/aiReport";
import { buildSdetectReportFromPdf } from "../lib/sdetectReport/buildReport";
import { generateKaiReportPdf } from "../lib/sdetectReport/generateKaiReportPdf";
import { SDETECT_RADAR_LABELS } from "../lib/sdetectReport/radarLabels";

async function main() {
  const input = process.argv[2] ?? "/Users/sagnikdey/Downloads/dr.pdf";
  const output =
    process.argv[3] ?? "/Users/sagnikdey/Downloads/skinfit-report_dr-preview.pdf";

  const buf = readFileSync(input);
  const report = await buildSdetectReportFromPdf(buf);
  const content = await buildKaiReportContent(report, { eventLabel: KAI_REPORT_EVENT_LABEL });
  const pdf = await generateKaiReportPdf(report, content, { eventLabel: KAI_REPORT_EVENT_LABEL });
  writeFileSync(output, pdf);

  console.log(
    JSON.stringify(
      {
        input,
        output,
        bytes: pdf.length,
        patient: report.patient,
        classification: report.classification,
        comprehensiveScore: report.comprehensiveScore,
        radarCount: report.radar.length,
        radarLabels: report.radar.map((m) => m.label),
        expectedRadarCount: SDETECT_RADAR_LABELS.length,
        contentRadarCount: content.radarLabels.length,
        hasFaces: Boolean(report.faceImages),
        faceSlots: report.faceImages
          ? {
              left: Boolean(report.faceImages.left),
              front: Boolean(report.faceImages.front),
              right: Boolean(report.faceImages.right),
            }
          : null,
        qrDecoded: Boolean(report.sourceReportUrl),
      },
      null,
      2
    )
  );
}

void main();
