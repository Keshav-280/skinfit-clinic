import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

declare global {
  // pdfjs fake-worker fast path in Node (see pdfjs-dist PDFWorker.#mainThreadWorkerMessageHandler)
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

const require = createRequire(import.meta.url);

let pdfJsModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;

function resolvePdfJsWorkerPath(): string {
  return path.join(
    path.dirname(require.resolve("pdfjs-dist/package.json")),
    "legacy/build/pdf.worker.mjs"
  );
}

/** pdfjs-dist needs an on-disk worker in Next standalone / Docker (/app). */
export async function loadPdfJsServer() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = resolvePdfJsWorkerPath();
      const workerUrl = pathToFileURL(workerPath).href;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      if (!globalThis.pdfjsWorker) {
        const workerMod = await import(/* webpackIgnore: true */ workerUrl);
        globalThis.pdfjsWorker = { WorkerMessageHandler: workerMod.WorkerMessageHandler };
      }

      return pdfjs;
    })();
  }
  return pdfJsModulePromise;
}
