import { SCAN_REPORT_PDF_BG } from "@/src/lib/scanReportPdfBackground";

/** Decorative layers behind scan report PDF content (html2canvas capture). */
export function ScanReportPdfBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: SCAN_REPORT_PDF_BG.linear }} />
      <div
        className="absolute -right-20 -top-24 h-[22rem] w-[22rem] rounded-full sm:h-[26rem] sm:w-[26rem]"
        style={{ background: SCAN_REPORT_PDF_BG.orbNavy }}
      />
      <div
        className="absolute -left-24 top-[42%] h-[20rem] w-[20rem] rounded-full"
        style={{ background: SCAN_REPORT_PDF_BG.orbSage }}
      />
      <div
        className="absolute -bottom-16 right-[8%] h-[16rem] w-[16rem] rounded-full"
        style={{ background: SCAN_REPORT_PDF_BG.orbAccent }}
      />
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: SCAN_REPORT_PDF_BG.topBand }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: SCAN_REPORT_PDF_BG.dotGrid,
          backgroundSize: SCAN_REPORT_PDF_BG.dotGridSize,
        }}
      />
    </div>
  );
}
