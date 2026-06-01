import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";

/** Shared palette for web capture + jsPDF page paint. */
export const SCAN_REPORT_PDF_BG = {
  linear:
    "linear-gradient(165deg, #ffffff 0%, #f8fbff 16%, #eef4fb 42%, #e4edf8 68%, #d9e6f3 100%)",
  orbNavy:
    "radial-gradient(circle, rgba(44,62,107,0.16) 0%, rgba(44,62,107,0.06) 42%, transparent 72%)",
  orbSage:
    "radial-gradient(circle, rgba(148,186,162,0.38) 0%, rgba(168,198,178,0.14) 45%, transparent 72%)",
  orbAccent:
    "radial-gradient(circle, rgba(74,111,165,0.18) 0%, rgba(74,111,165,0.06) 40%, transparent 70%)",
  topBand:
    "linear-gradient(90deg, rgba(30,50,100,0) 0%, rgba(44,62,107,0.22) 50%, rgba(30,50,100,0) 100%)",
  dotGrid: `radial-gradient(rgba(44,62,107,0.09) 0.55px, transparent 0.55px)`,
  dotGridSize: "20px 20px",
} as const;

/** Colors treated as empty margin when trimming html2canvas output. */
export const SCAN_REPORT_PDF_MARGIN_RGB = [
  { r: 255, g: 255, b: 255 },
  { r: 248, g: 251, b: 255 },
  { r: 238, g: 244, b: 251 },
  { r: 228, g: 237, b: 248 },
  { r: 217, g: 230, b: 243 },
  { r: 224, g: 232, b: 244 },
  { r: 212, g: 222, b: 238 },
  ...((): Array<{ r: number; g: number; b: number }> => {
    const hex = (h: string) => {
      const x = h.replace("#", "");
      return {
        r: parseInt(x.slice(0, 2), 16),
        g: parseInt(x.slice(2, 4), 16),
        b: parseInt(x.slice(4, 6), 16),
      };
    };
    return [hex(T.pageBg), hex(T.sageBand), hex(T.sageBandEnd), hex(T.accentLight)];
  })(),
];

function paintOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rgb: string,
  alphaPeak: number
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, `rgba(${rgb},${alphaPeak})`);
  g.addColorStop(0.45, `rgba(${rgb},${alphaPeak * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Rich page backdrop for jsPDF (matches web `ScanReportPdfBackdrop`). */
export function paintScanReportPdfBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const base = ctx.createLinearGradient(0, 0, width * 0.35, height);
  base.addColorStop(0, "#ffffff");
  base.addColorStop(0.16, "#f8fbff");
  base.addColorStop(0.42, "#eef4fb");
  base.addColorStop(0.68, "#e4edf8");
  base.addColorStop(1, "#d9e6f3");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  paintOrb(ctx, width * 0.86, height * 0.07, width * 0.42, "44,62,107", 0.14);
  paintOrb(ctx, width * 0.1, height * 0.52, width * 0.36, "148,186,162", 0.32);
  paintOrb(ctx, width * 0.74, height * 0.88, width * 0.3, "74,111,165", 0.16);

  const band = ctx.createLinearGradient(0, 0, width, 0);
  band.addColorStop(0, "rgba(30,50,100,0)");
  band.addColorStop(0.5, "rgba(44,62,107,0.2)");
  band.addColorStop(1, "rgba(30,50,100,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, width, Math.max(4, height * 0.012));

  ctx.fillStyle = "rgba(44,62,107,0.045)";
  const step = Math.max(8, Math.round(width / 24));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function scanReportPdfBackgroundCss(): string {
  return `
    .pdf-page {
      position: relative;
      overflow: hidden;
      background: ${SCAN_REPORT_PDF_BG.linear};
    }
    .pdf-bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background: ${SCAN_REPORT_PDF_BG.linear};
    }
    .pdf-bg-orb {
      position: absolute;
      border-radius: 9999px;
      pointer-events: none;
    }
    .pdf-bg-orb-navy {
      width: 420pt;
      height: 420pt;
      right: -80pt;
      top: -120pt;
      background: ${SCAN_REPORT_PDF_BG.orbNavy};
    }
    .pdf-bg-orb-sage {
      width: 360pt;
      height: 360pt;
      left: -90pt;
      top: 340pt;
      background: ${SCAN_REPORT_PDF_BG.orbSage};
    }
    .pdf-bg-orb-accent {
      width: 300pt;
      height: 300pt;
      right: 20pt;
      bottom: -40pt;
      background: ${SCAN_REPORT_PDF_BG.orbAccent};
    }
    .pdf-bg-band {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 5pt;
      background: ${SCAN_REPORT_PDF_BG.topBand};
    }
    .pdf-bg-dots {
      position: absolute;
      inset: 0;
      opacity: 0.55;
      background-image: ${SCAN_REPORT_PDF_BG.dotGrid};
      background-size: ${SCAN_REPORT_PDF_BG.dotGridSize};
    }
    .pdf-scale, .sheet { position: relative; z-index: 1; }
  `;
}
