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

/** Same naming as web `SkinScanReportBody` PDF download. */
export function buildScanReportPdfFileName(payload: ScanReportPdfPayload): string {
  const scanDate = new Date(payload.scanDateIso);
  const stamp = format(scanDate, "yyyy-MM-dd-HHmm");
  return `ai-scan-report-${stamp}.pdf`;
}

export async function generateScanReportPdfUri(
  payload: ScanReportPdfPayload
): Promise<string> {
  const html = buildScanReportPdfHtml(payload);
  const { uri } = await Print.printToFileAsync({
    html,
    width: 595,
    height: 842,
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
