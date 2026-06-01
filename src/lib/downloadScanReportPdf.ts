/**
 * Renders a DOM node to a single-page A4 PDF (client-only).
 * The full report is captured and scaled to fit one page.
 */

import { SCAN_REPORT_THEME as T } from "@/src/lib/scanReportTheme";
import {
  SCAN_REPORT_PDF_MARGIN_RGB,
  SCAN_REPORT_PDF_PAGE_BG,
} from "@/src/lib/scanReportPdfBackground";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

function isPatientScanImageApiSrc(raw: string): boolean {
  try {
    const u = new URL(raw, window.location.origin);
    return /\/api\/patient\/scans\/\d+\/image$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Full-resolution URL for PDF (strip `preview=1` used for on-screen display). */
function fullResolutionPatientScanImageSrc(raw: string): string {
  try {
    const u = new URL(raw, window.location.origin);
    if (!/\/api\/patient\/scans\/\d+\/image$/.test(u.pathname)) return raw;
    u.searchParams.delete("preview");
    u.searchParams.delete("thumb");
    const q = u.searchParams.toString();
    return q ? `${u.pathname}?${q}` : u.pathname;
  } catch {
    return raw;
  }
}

/** html2canvas often misses cookie-authenticated same-origin `/api/.../image` URLs — inline as data URLs first. */
async function inlinePatientScanFaceForPdf(root: HTMLElement): Promise<
  Array<{ img: HTMLImageElement; previousSrc: string; hadCrossOrigin: boolean }>
> {
  const restores: Array<{
    img: HTMLImageElement;
    previousSrc: string;
    hadCrossOrigin: boolean;
  }> = [];
  const imgs = Array.from(root.querySelectorAll("img"));
  for (const img of imgs) {
    const raw = (img.getAttribute("src") || "").trim();
    if (!isPatientScanImageApiSrc(raw)) {
      continue;
    }
    const abs = new URL(fullResolutionPatientScanImageSrc(raw), window.location.origin)
      .href;
    try {
      const res = await fetch(abs, { credentials: "include", cache: "force-cache" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.size) continue;
      const dataUrl = await blobToDataUrl(blob);
      const hadCrossOrigin = img.hasAttribute("crossorigin");
      restores.push({ img, previousSrc: img.src, hadCrossOrigin });
      img.removeAttribute("crossorigin");
      img.src = dataUrl;
    } catch {
      /* keep original src */
    }
  }
  return restores;
}

function waitImgLoaded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

function applyPdfCloneVisibility(clonedRoot: HTMLElement | Document) {
  const root =
    clonedRoot instanceof Document ? clonedRoot.body : clonedRoot;
  if (!root) return;
  root.querySelectorAll("[data-pdf-screen-only]").forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });
  root.querySelectorAll("[data-pdf-print-only]").forEach((el) => {
    (el as HTMLElement).style.display = "block";
  });
}

/** Widen nested columns so every captured section shares the same content width. */
function applyPdfCloneLayout(clonedRoot: HTMLElement | Document) {
  applyPdfCloneVisibility(clonedRoot);
  const root =
    clonedRoot instanceof Document ? clonedRoot.body : clonedRoot;
  if (!root) return;

  const pdfWidthPx = 720;
  root.querySelectorAll("[data-pdf-root], [data-pdf-section]").forEach((el) => {
    const node = el as HTMLElement;
    node.style.width = `${pdfWidthPx}px`;
    node.style.maxWidth = `${pdfWidthPx}px`;
    node.style.marginLeft = "auto";
    node.style.marginRight = "auto";
    node.style.boxSizing = "border-box";
    node.style.background = SCAN_REPORT_PDF_PAGE_BG;
  });

  root
    .querySelectorAll("[class*='max-w-']")
    .forEach((el) => {
      (el as HTMLElement).style.maxWidth = "100%";
    });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Trim uniform page-bg margins so the PDF uses more of the page (less "letterboxed" look). */
function cropCanvasToContent(
  canvas: HTMLCanvasElement,
  paddingPx = 10
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const bg = hexToRgb(T.pageBg);
  const tolerance = 26;

  const isMarginPixel = (r: number, g: number, b: number, a: number) => {
    if (a < 8) return true;
    return SCAN_REPORT_PDF_MARGIN_RGB.some(
      (sample) =>
        Math.abs(r - sample.r) <= tolerance &&
        Math.abs(g - sample.g) <= tolerance &&
        Math.abs(b - sample.b) <= tolerance
    ) || (
      Math.abs(r - bg.r) <= tolerance &&
      Math.abs(g - bg.g) <= tolerance &&
      Math.abs(b - bg.b) <= tolerance
    );
  };

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const step = 2;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (isMarginPixel(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) {
        continue;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return canvas;

  minX = Math.max(0, minX - paddingPx);
  minY = Math.max(0, minY - paddingPx);
  maxX = Math.min(width - 1, maxX + paddingPx);
  maxY = Math.min(height - 1, maxY + paddingPx);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return canvas;
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

/** Scale one tall canvas to fit a single A4 page (width + height). */
function appendCanvasToPdfSinglePage(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement
): void {
  const marginMm = 4;
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;

  const aspect = canvas.height / canvas.width;
  let imgWidthMm = usableWidthMm;
  let imgHeightMm = imgWidthMm * aspect;

  if (imgHeightMm > usableHeightMm) {
    imgHeightMm = usableHeightMm;
    imgWidthMm = imgHeightMm / aspect;
  }

  const xMm = marginMm + (usableWidthMm - imgWidthMm) / 2;
  const yMm = marginMm + (usableHeightMm - imgHeightMm) / 2;

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", xMm, yMm, imgWidthMm, imgHeightMm);
}

/** Hint PDF viewers to open at full-page fit (honored by Acrobat, Preview, many mobile viewers). */
function applyScanReportPdfOpenView(pdf: import("jspdf").jsPDF): void {
  if (typeof pdf.setDisplayMode === "function") {
    pdf.setDisplayMode("fullpage", "single");
  }
}

async function mergeSectionCanvases(
  canvases: HTMLCanvasElement[]
): Promise<HTMLCanvasElement> {
  if (canvases.length === 0) {
    throw new Error("PDF generation failed: no sections captured");
  }

  const cropped = canvases.map((c) => cropCanvasToContent(c));
  if (cropped.length === 1) return cropped[0]!;

  const width = Math.max(...cropped.map((c) => c.width));
  const totalHeight = cropped.reduce((sum, c) => sum + c.height, 0);
  const merged = document.createElement("canvas");
  merged.width = width;
  merged.height = totalHeight;
  const ctx = merged.getContext("2d");
  if (!ctx) throw new Error("PDF generation failed: no 2D context");

  let y = 0;
  for (const c of cropped) {
    ctx.fillStyle = T.pageBg;
    ctx.fillRect(0, y, width, c.height);
    const x = Math.floor((width - c.width) / 2);
    ctx.drawImage(c, x, y);
    y += c.height;
  }
  return cropCanvasToContent(merged, 6);
}

async function renderReportToJsPdf(element: HTMLElement) {
  const restores = await inlinePatientScanFaceForPdf(element);
  try {
    await Promise.all(restores.map(({ img }) => waitImgLoaded(img)));

    const imgs = Array.from(element.querySelectorAll("img"));
    const waitForImages = Promise.allSettled(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      })
    );
    const timeoutMs = 8000;
    await Promise.race([
      waitForImages,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    await new Promise((r) => setTimeout(r, 250));

    const html2canvas = (await import("html2canvas-pro")).default;
    const { jsPDF } = await import("jspdf");

    const sectionNodes = Array.from(
      element.querySelectorAll("[data-pdf-section]")
    ) as HTMLElement[];

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const captureOpts = {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
      logging: false,
      backgroundColor: SCAN_REPORT_PDF_PAGE_BG,
      onclone: (_doc: Document, cloned: HTMLElement) => {
        applyPdfCloneLayout(cloned);
      },
    } as const;

    let mergedCanvas: HTMLCanvasElement;
    if (sectionNodes.length > 0) {
      const canvases: HTMLCanvasElement[] = [];
      for (const node of sectionNodes) {
        canvases.push(await html2canvas(node, captureOpts));
      }
      mergedCanvas = await mergeSectionCanvases(canvases);
    } else {
      mergedCanvas = cropCanvasToContent(
        await html2canvas(element, captureOpts),
        6
      );
    }

    appendCanvasToPdfSinglePage(pdf, mergedCanvas);
    applyScanReportPdfOpenView(pdf);
    return pdf;
  } finally {
    for (const { img, previousSrc, hadCrossOrigin } of restores) {
      img.src = previousSrc;
      if (hadCrossOrigin) {
        img.setAttribute("crossorigin", "anonymous");
      } else {
        img.removeAttribute("crossorigin");
      }
    }
  }
}

export async function renderScanReportPdfBlob(
  element: HTMLElement
): Promise<Blob> {
  const pdf = await renderReportToJsPdf(element);
  return pdf.output("blob");
}

export async function downloadScanReportPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const pdf = await renderReportToJsPdf(element);
  pdf.save(filename);
}
