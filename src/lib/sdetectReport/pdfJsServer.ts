import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const nodeRequire = createRequire(import.meta.url);

declare global {
  // pdfjs fake-worker fast path in Node (see pdfjs-dist PDFWorker.#mainThreadWorkerMessageHandler)
  // eslint-disable-next-line no-var
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined;
}

let pdfJsModulePromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;

/**
 * Resolve the on-disk worker path. We avoid relying solely on `require.resolve`
 * because the Next.js webpack bundle rewrites it to return a numeric module id
 * instead of a file path, which breaks `pathToFileURL`.
 */
function resolvePdfJsWorkerPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ];

  try {
    const pkg = nodeRequire.resolve("pdfjs-dist/package.json");
    if (typeof pkg === "string") {
      candidates.push(path.join(path.dirname(pkg), "legacy/build/pdf.worker.mjs"));
    }
  } catch {
    /* fall back to the cwd candidate below */
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** pdfjs-dist needs an on-disk worker in Next standalone / Docker (/app). */
export async function loadPdfJsServer() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = resolvePdfJsWorkerPath();

      if (workerPath) {
        const workerUrl = pathToFileURL(workerPath).href;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        if (!globalThis.pdfjsWorker) {
          const workerMod = await import(/* webpackIgnore: true */ workerUrl);
          globalThis.pdfjsWorker = {
            WorkerMessageHandler: workerMod.WorkerMessageHandler,
          };
        }
      }

      return pdfjs;
    })();
  }
  return pdfJsModulePromise;
}
