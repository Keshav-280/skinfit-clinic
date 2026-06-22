import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSdetectReportFromPdf } from "../lib/sdetectReport/buildReport";
import { generateSkinfitReportPdf } from "../lib/sdetectReport/generateSkinfitReportPdf";

async function main() {
  const input = process.argv[2] ?? "/Users/sagnikdey/Downloads/report (2).pdf";
  const output =
    process.argv[3] ??
    path.join(process.cwd(), "local-tools/skinfit-report-preview.pdf");

  const buf = readFileSync(input);
  const report = await buildSdetectReportFromPdf(buf);
  const pdf = await generateSkinfitReportPdf(report);
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
        moisture: report.moisture,
        hasFaces: Boolean(report.faceImages),
        qrDecoded: Boolean(report.sourceReportUrl),
      },
      null,
      2
    )
  );
}

void main();
