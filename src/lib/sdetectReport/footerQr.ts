import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export type FooterQrAsset = {
  dataUrl: string;
  displayW: number;
  displayH: number;
};

const QR_PATH = path.join(process.cwd(), "public/branding/skinfit-consult-qr.png");
const QR_PRINT_DPI = 300;

let qrCache: FooterQrAsset | null = null;

export async function loadFooterConsultQr(displayH: number): Promise<FooterQrAsset> {
  if (qrCache && qrCache.displayH === displayH) return qrCache;

  const buffer = await readFile(QR_PATH);
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width ?? 550;
  const srcH = meta.height ?? 604;
  const aspect = srcW / srcH;
  const displayW = displayH * aspect;

  const targetPxH = Math.max(1, Math.round((displayH * QR_PRINT_DPI) / 25.4));
  const targetPxW = Math.max(1, Math.round(targetPxH * aspect));
  const raster = await sharp(buffer)
    .resize(targetPxW, targetPxH, { fit: "fill" })
    .png({ compressionLevel: 6 })
    .toBuffer();

  const asset: FooterQrAsset = {
    dataUrl: `data:image/png;base64,${raster.toString("base64")}`,
    displayW,
    displayH,
  };
  qrCache = asset;
  return asset;
}
