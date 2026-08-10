/**
 * Client-side PDF export for the kAI Initial/Update report phone frame.
 */

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

/** Cookie-auth scan images often fail in html2canvas — inline as data URLs first. */
async function inlinePatientScanImages(
  root: HTMLElement
): Promise<
  Array<{ img: HTMLImageElement; previousSrc: string; hadCrossOrigin: boolean }>
> {
  const restores: Array<{
    img: HTMLImageElement;
    previousSrc: string;
    hadCrossOrigin: boolean;
  }> = [];
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const raw = (img.getAttribute("src") || "").trim();
    if (!isPatientScanImageApiSrc(raw)) continue;
    const abs = new URL(
      fullResolutionPatientScanImageSrc(raw),
      window.location.origin
    ).href;
    try {
      const res = await fetch(abs, {
        credentials: "include",
        cache: "force-cache",
      });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.size) continue;
      const dataUrl = await blobToDataUrl(blob);
      const hadCrossOrigin = img.hasAttribute("crossorigin");
      restores.push({ img, previousSrc: img.src, hadCrossOrigin });
      img.removeAttribute("crossorigin");
      img.src = dataUrl;
    } catch {
      /* keep original */
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

/**
 * Capture `element` (kAI report frame) to a multi-page A4 PDF and download it.
 */
export async function downloadKaiReportPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const restores = await inlinePatientScanImages(element);
  try {
    await Promise.all(restores.map(({ img }) => waitImgLoaded(img)));

    const imgs = Array.from(element.querySelectorAll("img"));
    await Promise.race([
      Promise.allSettled(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        })
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);

    await new Promise((r) => setTimeout(r, 120));

    const html2canvas = (await import("html2canvas-pro")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
      logging: false,
      backgroundColor: "#EEF3EC",
      onclone: (_doc, cloned) => {
        cloned.querySelectorAll("[data-pdf-screen-only]").forEach((el) => {
          (el as HTMLElement).style.display = "none";
        });
        // Avoid clipping tall content during capture
        cloned.style.minHeight = "auto";
        cloned.style.height = "auto";
        cloned.style.overflow = "visible";
      },
    });

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const pageContentHeight = pageHeight - margin * 2;

    let heightLeft = imgHeight;
    let offsetY = 0;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    while (heightLeft > 0) {
      pdf.addImage(
        imgData,
        "JPEG",
        margin,
        margin + offsetY,
        contentWidth,
        imgHeight
      );
      heightLeft -= pageContentHeight;
      if (heightLeft > 0) {
        offsetY -= pageContentHeight;
        pdf.addPage();
      }
    }

    pdf.save(filename);
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
