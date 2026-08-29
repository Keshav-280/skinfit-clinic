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
    .pdf-page::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(820px 420px at -12% -6%, rgba(62, 94, 166, 0.26), transparent 56%),
        radial-gradient(680px 360px at 112% 18%, rgba(41, 197, 168, 0.2), transparent 58%),
        radial-gradient(780px 420px at 50% 108%, rgba(22, 160, 133, 0.18), transparent 62%),
        repeating-linear-gradient(
          115deg,
          rgba(255, 255, 255, 0.22) 0px,
          rgba(255, 255, 255, 0.22) 1px,
          transparent 1px,
          transparent 26px
        );
      pointer-events: none;
      z-index: 0;
    }
    .pdf-page::after {
      content: "";
      position: absolute;
      left: 6pt;
      right: 6pt;
      top: 6pt;
      bottom: 6pt;
      border: 1px solid rgba(30, 27, 49, 0.12);
      border-radius: 18px;
      pointer-events: none;
      z-index: 0;
    }
    .pdf-scale, .sheet { position: relative; z-index: 1; }
  `;
}
