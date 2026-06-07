import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";

import { NAVY } from "@/components/profile/theme";

export type MonthlyInsightExportData = {
  summaryTitle: string;
  summaryBody: string;
  highlights: string[];
  risks: string[];
  nextMonthFocus: string[];
  kaiMonthAvgFromParams: number | null;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMonthlyInsightHtml(monthly: MonthlyInsightExportData): string {
  const items = (arr: string[], ordered: boolean) => {
    const tag = ordered ? "ol" : "ul";
    const inner = arr.map((x) => `<li>${escHtml(x)}</li>`).join("");
    return `<${tag}>${inner}</${tag}>`;
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:20px;color:#18181b;line-height:1.5}
h1{font-size:18px;font-weight:700}
.kai{font-size:32px;font-weight:800;color:${NAVY};margin:12px 0}
p.body{white-space:pre-wrap}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin-top:16px;color:#52525b}
</style></head><body>
<h1>${escHtml(monthly.summaryTitle)}</h1>
<p class="body">${escHtml(monthly.summaryBody)}</p>
<p class="kai">Month kAI: ${monthly.kaiMonthAvgFromParams ?? "—"}</p>
<h2>Highlights</h2>${items((monthly.highlights ?? []).slice(0, 8), false)}
<h2>Risks</h2>${items((monthly.risks ?? []).slice(0, 8), false)}
<h2>Next focus</h2>${items((monthly.nextMonthFocus ?? []).slice(0, 8), true)}
</body></html>`;
}

export async function exportMonthlyInsightPdf(monthly: MonthlyInsightExportData) {
  try {
    const { uri } = await Print.printToFileAsync({
      html: buildMonthlyInsightHtml(monthly),
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Monthly insight",
      });
    } else {
      Alert.alert("PDF", "Sharing is not available on this device.");
    }
  } catch (e) {
    Alert.alert("Export", e instanceof Error ? e.message : "Could not create PDF.");
  }
}
