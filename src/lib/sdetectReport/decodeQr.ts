import { spawn } from "node:child_process";
import path from "node:path";

export async function decodeQrFromPdf(pdfBuffer: Buffer): Promise<string | null> {
  const script = path.join(process.cwd(), "scripts/sdetect_decode_pdf_qr.py");
  const python = process.env.SDETECT_QR_PYTHON ?? "python3";
  return new Promise((resolve) => {
    const proc = spawn(python, [script], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      try {
        const parsed = JSON.parse(stdout.trim()) as {
          url?: string | null;
          error?: string;
        };
        resolve(parsed.url ?? null);
      } catch {
        resolve(null);
      }
    });
    proc.stdin.write(pdfBuffer);
    proc.stdin.end();
  });
}

export function parseReportUrlParams(url: string): {
  reportSn: string;
  token: string;
  apiBase: string;
} | null {
  const reportSn = url.match(/[?&#]report_sn=([^&#]+)/)?.[1];
  const token = url.match(/[?&#]token=([^&#]+)/)?.[1];
  if (!reportSn || !token) return null;

  const host = url.match(/https?:\/\/([^/]+)/)?.[1] ?? "";
  const apiHosts: Record<string, string> = {
    "ff.sdetect.vip": "https://a3ff-api.bitmoji-zm.com",
    "cn.sdetect.vip": "https://a3cn-api.bitmoji-zm.com",
    "eu.sdetect.vip": "https://a3eu-api.bitmoji-zm.com",
  };
  const apiBase = apiHosts[host] ?? "https://a3ff-api.bitmoji-zm.com";
  return { reportSn, token, apiBase };
}
