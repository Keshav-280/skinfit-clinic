/**
 * Renders a DOM node to a multi-page A4 PDF (client-only).
 */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
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
    if (!raw.includes("/api/patient/scans/") || !raw.endsWith("/image")) {
      continue;
    }
    const abs = new URL(raw, window.location.origin).href;
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

/** Tracks vertical position so the next PDF slice can continue below the previous one instead of always starting a new page (fixes huge blank gaps between sections). */
type PdfVerticalFlow = {
  nextTopMm: number;
  hasPlacedAnything: boolean;
};

function appendCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  flow: PdfVerticalFlow
): void {
  const marginMm = 8;
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;
  const contentBottomMm = pageHeightMm - marginMm;
  const epsMm = 0.35;

  const pxFullHeight = canvas.height;
  const pxPageHeight = Math.round(
    (canvas.width * usableHeightMm) / usableWidthMm
  );
  const nPages = Math.ceil(pxFullHeight / pxPageHeight);

  for (let page = 0; page < nPages; page++) {
    if (!flow.hasPlacedAnything) {
      flow.nextTopMm = marginMm;
    }

    const pageCanvas = document.createElement("canvas");
    const pageHeightPx = Math.min(
      pxPageHeight,
      pxFullHeight - page * pxPageHeight
    );
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageHeightPx;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("PDF generation failed: no 2D context");

    ctx.drawImage(
      canvas,
      0,
      page * pxPageHeight,
      canvas.width,
      pageHeightPx,
      0,
      0,
      canvas.width,
      pageHeightPx
    );

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
    const pageHeightMmActualUnclamped =
      (pageHeightPx * usableWidthMm) / canvas.width;
    const pageHeightMmActual = Math.min(
      usableHeightMm,
      pageHeightMmActualUnclamped
    );

    if (
      flow.hasPlacedAnything &&
      flow.nextTopMm + pageHeightMmActual > contentBottomMm + epsMm
    ) {
      pdf.addPage();
      flow.nextTopMm = marginMm;
    }

    pdf.addImage(
      imgData,
      "JPEG",
      marginMm,
      flow.nextTopMm,
      usableWidthMm,
      pageHeightMmActual
    );
    flow.nextTopMm += pageHeightMmActual;
    flow.hasPlacedAnything = true;
  }
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
      backgroundColor: "#F5F1E9",
    } as const;

    const flow: PdfVerticalFlow = {
      nextTopMm: 8,
      hasPlacedAnything: false,
    };

    if (sectionNodes.length > 0) {
      for (const node of sectionNodes) {
        const canvas = await html2canvas(node, captureOpts);
        appendCanvasToPdf(pdf, canvas, flow);
      }
    } else {
      const canvas = await html2canvas(element, captureOpts);
      appendCanvasToPdf(pdf, canvas, flow);
    }

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
