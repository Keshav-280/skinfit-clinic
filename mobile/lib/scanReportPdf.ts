import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";

import {
  buildScanReportPdfHtml,
  type ScanReportPdfPayload,
} from "./scanReportPdfHtml";

/** Same report content and section order as the web dashboard PDF (expo-print HTML, not html2canvas). */
export type { ScanReportPdfPayload };

/** URL-safe file base (ASCII) so Android/iOS keep the name when saving to Files / Downloads. */
function slugifyTitle(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 48).toLowerCase();
}

function displayScanTitle(scanTitle: string | null | undefined): string {
  const t = scanTitle?.trim() ?? "";
  if (!t) return "";
  return t
    .replace(/^ai\s*skin\s*scan\s*[–-]\s*/i, "")
    .replace(/^ai\s*skin\s*analysis\s*$/i, "")
    .trim();
}

/** e.g. SkinnFit-morning-checkin-2026-04-03-1430.pdf */
export function buildScanReportPdfFileName(payload: ScanReportPdfPayload): string {
  const scanDate = new Date(payload.scanDateIso);
  const stamp = format(scanDate, "yyyy-MM-dd-HHmm");
  const slug = slugifyTitle(displayScanTitle(payload.scanTitle)) || "skin-scan";
  return `SkinnFit-${slug}-${stamp}.pdf`;
}

export async function generateScanReportPdfUri(
  payload: ScanReportPdfPayload
): Promise<string> {
  const html = buildScanReportPdfHtml(payload);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return uri;
}

export async function shareScanReportPdf(payload: ScanReportPdfPayload): Promise<void> {
  const tempUri = await generateScanReportPdfUri(payload);
  const fileName = buildScanReportPdfFileName(payload);

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("Device cache is unavailable.");
  }
  const shareUri = `${cacheDir}${fileName}`;
  const existing = await FileSystem.getInfoAsync(shareUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(shareUri, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: tempUri, to: shareUri });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  const dialogTitle = fileName.replace(/\.pdf$/i, "");

  await Sharing.shareAsync(shareUri, {
    UTI: "com.adobe.pdf",
    mimeType: "application/pdf",
    dialogTitle,
  });
}
