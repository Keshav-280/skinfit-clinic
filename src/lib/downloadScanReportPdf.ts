/**
 * Renders a DOM node to a multi-page A4 PDF (client-only).
 */
export async function downloadScanReportPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;
  await html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#F5F1E9",
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}
