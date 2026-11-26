import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  httpsUrl,
  parseReportLink,
  readMedixoraData,
  reportProblem,
  SHORT_LINK_HOSTS,
  VIEWS,
  type MedixoraReport,
  type ReportLink,
  type View,
} from "@/src/lib/medixora/report";

/** A message that is safe to show clinic staff. */
export class MedixoraError extends Error {}

const TIMEOUT_MS = 30_000;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * Follows a shared short link by hand, only through the short-link sites, until a Medixora report
 * link appears. The server never opens an address typed or scanned by someone else directly.
 */
export async function resolveReportLink(raw: string): Promise<ReportLink> {
  let current = raw.trim();
  for (let hop = 0; hop < 5; hop++) {
    const direct = parseReportLink(current);
    if (direct) return direct;
    const url = httpsUrl(current);
    if (!url || !SHORT_LINK_HOSTS.includes(url.hostname)) break;
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const location = res.headers.get("location");
    if (!location) break;
    current = new URL(location, url).toString();
  }
  throw new MedixoraError("This is not a Medixora report link. Scan the QR on the Medixora screen.");
}

/** One-way id of a report, used to stop the same report being saved twice. */
export function reportKey(reportSn: string): string {
  return createHash("sha256").update(reportSn).digest("hex");
}

export async function fetchMedixoraReport(
  raw: string
): Promise<{ key: string; report: MedixoraReport }> {
  const link = await resolveReportLink(raw);
  const res = await fetch(`${link.apiBase}/api/h5/getreportdata`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ report_sn: link.reportSn, token: link.token }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new MedixoraError("Medixora did not answer. Try again in a minute.");
  const payload = (await res.json()) as { success?: boolean; data?: { data?: unknown } };
  if (!payload.success || !payload.data?.data) {
    throw new MedixoraError("Medixora returned no report for this QR. It may have expired: open it again on the machine.");
  }
  const report = readMedixoraData(payload.data.data);
  const problem = reportProblem(report);
  if (problem) throw new MedixoraError(problem);
  return { key: reportKey(link.reportSn), report };
}

export type Photo = { jpeg: Buffer; width: number; height: number };

async function fetchPhoto(url: string): Promise<Photo> {
  // `redirect: "error"`: the allowed storage must not forward us somewhere else.
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length === 0 || raw.length > MAX_PHOTO_BYTES) throw new Error("photo size");
  const { data, info } = await sharp(raw)
    .rotate()
    .resize({ width: 900, height: 1200, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

/** All photos the report offers. A photo that fails to download stops the save, so none go missing quietly. */
export async function fetchReportPhotos(
  report: MedixoraReport
): Promise<Record<View, Photo | null>> {
  const out: Record<View, Photo | null> = { front: null, left: null, right: null };
  await Promise.all(
    VIEWS.map(async (view) => {
      const url = report.photoUrls[view];
      if (!url) return;
      try {
        out[view] = await fetchPhoto(url);
      } catch {
        try {
          out[view] = await fetchPhoto(url);
        } catch {
          throw new MedixoraError("A photo could not be downloaded. Please try again.");
        }
      }
    })
  );
  return out;
}
