import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";

/** On-screen report card chrome (not exported in PDF). */
export const SCAN_REPORT_PDF_BG = {
  linear:
    "linear-gradient(165deg, #ffffff 0%, #f8fbff 16%, #eef4fb 42%, #e4edf8 68%, #d9e6f3 100%)",
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const x = hex.replace("#", "");
  return {
    r: parseInt(x.slice(0, 2), 16),
    g: parseInt(x.slice(2, 4), 16),
    b: parseInt(x.slice(4, 6), 16),
  };
}

/** Plain page fill for PDF export (web + mobile HTML). */
export const SCAN_REPORT_PDF_PAGE_BG = T.pageBg;

/** Colors treated as empty margin when trimming html2canvas output. */
export const SCAN_REPORT_PDF_MARGIN_RGB = [
  { r: 255, g: 255, b: 255 },
  hexToRgb(T.pageBg),
  hexToRgb(T.sageBand),
  hexToRgb(T.accentLight),
];

export function scanReportPdfBackgroundCss(): string {
  return `
    .pdf-page {
      position: relative;
      overflow: hidden;
      background: ${SCAN_REPORT_PDF_PAGE_BG};
    }
    .pdf-scale, .sheet { position: relative; z-index: 1; }
  `;
}
