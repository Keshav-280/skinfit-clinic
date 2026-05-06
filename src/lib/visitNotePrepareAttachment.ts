import { MAX_VISIT_NOTE_ATTACHMENT_URI_LEN } from "@/src/lib/visitNoteAttachments";

/** Keep in sync with `pdfjs-dist` in package.json (worker must match API). */
const PDFJS_DIST_VER = "4.10.38";

function stripExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") resolve(r.result);
      else reject(new Error("read"));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image-load"));
    };
    img.src = url;
  });
}

function canvasToJpegDataUrl(
  img: HTMLImageElement,
  maxWidth: number,
  quality: number
): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("bad-dim");
  const scale = w > maxWidth ? maxWidth / w : 1;
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas-ctx");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}

async function imageFileToJpegDataUriUnderCap(
  file: File,
  maxUriLen: number
): Promise<string> {
  const img = await loadImageFromBlob(file);
  let targetMaxWidth = Math.min(2400, Math.max(img.naturalWidth, 1));
  let quality = 0.92;
  let best = canvasToJpegDataUrl(img, targetMaxWidth, quality);

  for (let attempt = 0; attempt < 36; attempt++) {
    if (best.length <= maxUriLen) return best;
    quality -= 0.05;
    if (quality < 0.42) {
      quality = 0.88;
      targetMaxWidth = Math.floor(targetMaxWidth * 0.88);
    }
    if (targetMaxWidth < 360) {
      best = canvasToJpegDataUrl(img, 360, 0.72);
      break;
    }
    best = canvasToJpegDataUrl(img, targetMaxWidth, quality);
  }
  return best;
}

const MAX_PDF_PAGES_RASTER = 12;

async function pdfFileToJpegDataUriUnderCap(
  file: File,
  maxUriLen: number
): Promise<{ dataUri: string; pagesRasterized: number; totalPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VER}/build/pdf.worker.min.mjs`;
  }

  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  const pdf = await pdfjs.getDocument({ data }).promise;
  const totalPages = pdf.numPages;
  const numPages = Math.min(totalPages, MAX_PDF_PAGES_RASTER);

  let scale = 1.35;
  let best = "";

  for (let attempt = 0; attempt < 22; attempt++) {
    const pageCanvases: HTMLCanvasElement[] = [];
    let maxW = 0;
    let totalH = 0;
    const gap = 6;

    for (let i = 1; i <= numPages; i += 1) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas-ctx");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
      });
      await renderTask.promise;
      pageCanvases.push(canvas);
      maxW = Math.max(maxW, canvas.width);
      totalH += canvas.height + (i < numPages ? gap : 0);
    }

    const master = document.createElement("canvas");
    master.width = maxW;
    master.height = totalH;
    const mctx = master.getContext("2d");
    if (!mctx) throw new Error("no-canvas-ctx");
    mctx.fillStyle = "#ffffff";
    mctx.fillRect(0, 0, master.width, master.height);
    let y = 0;
    for (let i = 0; i < pageCanvases.length; i += 1) {
      const c = pageCanvases[i];
      mctx.drawImage(c, 0, y);
      y += c.height + gap;
    }

    let quality = 0.84;
    for (let q = 0; q < 18; q += 1) {
      const uri = master.toDataURL("image/jpeg", quality);
      best = uri;
      if (uri.length <= maxUriLen) {
        return { dataUri: uri, pagesRasterized: numPages, totalPages };
      }
      quality -= 0.055;
      if (quality < 0.38) break;
    }

    scale *= 0.88;
    if (scale < 0.55) break;
  }

  return { dataUri: best, pagesRasterized: numPages, totalPages };
}

export type PreparedVisitNoteAttachment =
  | { ok: true; fileName: string; mimeType: string; dataUri: string }
  | { ok: false; error: string };

/**
 * Shrinks images (JPEG/PNG/WebP/GIF) and rasterizes PDFs so data URIs fit the visit-note cap.
 * Runs in the browser only.
 */
export async function prepareVisitNoteAttachmentFile(
  file: File,
  maxUriLen: number = MAX_VISIT_NOTE_ATTACHMENT_URI_LEN
): Promise<PreparedVisitNoteAttachment> {
  if (typeof document === "undefined") {
    return { ok: false, error: "Attachments must be prepared in the browser." };
  }

  const name = file.name.trim().slice(0, 200) || "attachment";
  const type = (file.type || "").toLowerCase();
  const lower = name.toLowerCase();

  try {
    const isPdf = type === "application/pdf" || lower.endsWith(".pdf");
    if (isPdf) {
      const { dataUri, pagesRasterized, totalPages } = await pdfFileToJpegDataUriUnderCap(
        file,
        maxUriLen
      );
      if (!dataUri || dataUri.length > maxUriLen) {
        return {
          ok: false,
          error: `Could not compress PDF enough: ${name}. Try a shorter document or export pages as images.`,
        };
      }
      const base = stripExtension(name);
      const pageHint =
        totalPages > pagesRasterized ? `-pages1-${pagesRasterized}of${totalPages}` : "";
      return {
        ok: true,
        fileName: `${base}${pageHint}.jpg`,
        mimeType: "image/jpeg",
        dataUri,
      };
    }

    if (type.startsWith("image/")) {
      if (type === "image/svg+xml") {
        const dataUri = await blobToDataUri(file);
        if (dataUri.length <= maxUriLen) {
          return { ok: true, fileName: name, mimeType: type, dataUri };
        }
        return { ok: false, error: `SVG too large: ${name}.` };
      }

      const dataUri = await imageFileToJpegDataUriUnderCap(file, maxUriLen);
      if (dataUri.length > maxUriLen) {
        return { ok: false, error: `Could not compress image enough: ${name}.` };
      }
      const jpgName = /\.(jpe?g|png|gif|webp)$/i.test(name)
        ? name.replace(/\.(jpe?g|png|gif|webp)$/i, ".jpg")
        : `${stripExtension(name)}.jpg`;
      return { ok: true, fileName: jpgName, mimeType: "image/jpeg", dataUri };
    }

    if (type === "text/plain" || lower.endsWith(".txt")) {
      const text = await file.text();
      const prefix = "data:text/plain;charset=utf-8,";
      let body = encodeURIComponent(text);
      let dataUri = prefix + body;
      if (dataUri.length > maxUriLen) {
        let cut = text.length;
        const budget = maxUriLen - prefix.length - 40;
        while (cut > 0 && encodeURIComponent(text.slice(0, cut)).length > budget) {
          cut = Math.floor(cut * 0.9);
        }
        dataUri =
          prefix +
          encodeURIComponent(text.slice(0, cut) + (cut < text.length ? "\n… [truncated]" : ""));
        if (dataUri.length > maxUriLen) {
          return { ok: false, error: `Text file too large: ${name}.` };
        }
      }
      return { ok: true, fileName: name, mimeType: "text/plain", dataUri };
    }

    const dataUri = await blobToDataUri(file);
    if (dataUri.length > maxUriLen) {
      return {
        ok: false,
        error: `File too large or unsupported type: ${name}. Use PDF, an image, or plain text.`,
      };
    }
    return {
      ok: true,
      fileName: name,
      mimeType: type || "application/octet-stream",
      dataUri,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { ok: false, error: `Could not process ${name}: ${msg}` };
  }
}
