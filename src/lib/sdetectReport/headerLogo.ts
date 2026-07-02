import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ptToMm } from "./pdfPage";

export type LogoAsset = { dataUrl: string; displayW: number; displayH: number };

/** Header logo display height on the PDF page (millimetres). */
export const HEADER_LOGO_DISPLAY_H = ptToMm(26);

/** Target print resolution for rasterising the vector logo. */
const LOGO_PRINT_DPI = 300;
/** Extra supersampling before PDF embed (image is downscaled to display mm). */
const LOGO_SUPERSAMPLE = 2;

let logoCache: LogoAsset | null = null;

function logoRasterHeight(displayHmm: number): number {
  return Math.round((displayHmm * LOGO_PRINT_DPI * LOGO_SUPERSAMPLE) / 25.4);
}

export async function loadHeaderLogo(
  displayH: number = HEADER_LOGO_DISPLAY_H
): Promise<LogoAsset> {
  if (logoCache && displayH === HEADER_LOGO_DISPLAY_H) return logoCache;

  const svgPath = path.join(process.cwd(), "public/branding/skinfit-wellness-logo.svg");
  const wellnessPng = path.join(process.cwd(), "public/branding/skinfit-wellness-logo.png");
  const rasterH = logoRasterHeight(displayH);
  const density = LOGO_PRINT_DPI * LOGO_SUPERSAMPLE;
  const pngOpts = { compressionLevel: 0 as const, adaptiveFiltering: false as const };

  let raster: Buffer;
  try {
    raster = await sharp(svgPath, { density })
      .resize({ height: rasterH, kernel: sharp.kernel.lanczos3 })
      .flatten({ background: "#ffffff" })
      .png(pngOpts)
      .toBuffer();
  } catch {
    const buffer = await readFile(wellnessPng);
    const sourceMeta = await sharp(buffer).metadata();
    const sourceH = sourceMeta.height ?? 0;
    const pipeline = sharp(buffer);
    raster =
      sourceH > rasterH
        ? await pipeline
            .resize({ height: rasterH, kernel: sharp.kernel.lanczos3 })
            .png(pngOpts)
            .toBuffer()
        : await pipeline.png(pngOpts).toBuffer();
  }

  const meta = await sharp(raster).metadata();
  const aspect = (meta.width ?? 248) / (meta.height ?? rasterH);
  const displayW = displayH * aspect;

  const asset: LogoAsset = {
    dataUrl: `data:image/png;base64,${raster.toString("base64")}`,
    displayW,
    displayH: displayH,
  };

  if (displayH === HEADER_LOGO_DISPLAY_H) logoCache = asset;
  return asset;
}
