/**
 * Renders a DOM node to a multi-page A4 PDF (client-only).
 */
async function renderReportToJsPdf(element: HTMLElement) {
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
  const timeoutMs = 2500;
  await Promise.race([
    waitForImages,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  await new Promise((r) => setTimeout(r, 250));

  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    foreignObjectRendering: false,
    logging: false,
    backgroundColor: "#F5F1E9",
  });

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  const marginMm = 8;
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;

  const pxFullHeight = canvas.height;
  const pxPageHeight = Math.round(
    (canvas.width * usableHeightMm) / usableWidthMm
  );
  const nPages = Math.ceil(pxFullHeight / pxPageHeight);

  for (let page = 0; page < nPages; page++) {
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

    if (page > 0) pdf.addPage();
    pdf.addImage(
      imgData,
      "JPEG",
      marginMm,
      marginMm,
      usableWidthMm,
      pageHeightMmActual
    );
  }

  return pdf;
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
