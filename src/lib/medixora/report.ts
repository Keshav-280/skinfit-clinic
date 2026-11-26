/**
 * Reading a Medixora report: which links are accepted, and which parts of the machine's data
 * SkinFit keeps (front, left and right white-light photos plus the scores). Pure module.
 */

/** Report viewer sites and the data server behind each. Nothing else is ever called. */
const VIEWER_HOSTS: Record<string, string> = {
  "ff.sdetect.vip": "https://a3ff-api.bitmoji-zm.com",
  "cn.sdetect.vip": "https://a3cn-api.bitmoji-zm.com",
  "eu.sdetect.vip": "https://a3eu-api.bitmoji-zm.com",
};
/** Short links the clinic shares, which redirect to a report link. */
export const SHORT_LINK_HOSTS = ["share.google", "www.google.com"];

export type ReportLink = { apiBase: string; reportSn: string; token: string };

export function httpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" && !url.username && !url.port ? url : null;
  } catch {
    return null;
  }
}

/** The report number and key inside a Medixora report link, or null for any other link. */
export function parseReportLink(raw: string): ReportLink | null {
  const url = httpsUrl(raw);
  if (!url) return null;
  const apiBase = VIEWER_HOSTS[url.hostname];
  if (!apiBase) return null;
  // The parameters sit after "#/report?" (older links may use a plain query).
  const params = new URLSearchParams(url.hash.split("?")[1] ?? url.search);
  const reportSn = params.get("report_sn") ?? "";
  const token = params.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(reportSn) || token.length < 8 || token.length > 600) return null;
  return { apiBase, reportSn, token };
}

/** Photos may only be fetched from the machine maker's storage. */
export function isAllowedPhotoUrl(raw: string): boolean {
  const url = httpsUrl(raw);
  if (!url) return false;
  return (
    /^bitmoji[a-z0-9-]*\.s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(url.hostname) ||
    /(^|\.)(bitmoji-zm\.com|sdetect\.vip)$/.test(url.hostname)
  );
}

export const VIEWS = ["front", "left", "right"] as const;
export type View = (typeof VIEWS)[number];
export const VIEW_LABELS: Record<View, string> = { front: "Front", left: "Left", right: "Right" };
/** Medixora camera angle codes. LightType "1" is the white light photo. */
const FACE_TYPE: Record<View, string> = { front: "2", left: "1", right: "3" };
const WHITE_LIGHT_TYPE = "1";

/** Everyday concerns first; anything else the machine adds follows in its own order. */
const SCORE_ORDER = [
  "Acne", "Pores", "Blackhead", "Wrinkle", "Mixed spot", "Superficial pigment", "Deep Pigment",
  "Brown pigment", "Sebum", "Moisture", "Skin Barrier", "Collagen", "Porphyrin",
  "Fluorescent Agent", "Heat Map of Pigment", "Red Map of Sensitivity", "Heat Map of Sensitivity",
];

export type ScoreRow = { name: string } & Record<View, number | null>;

export type MedixoraReport = {
  customer: { name: string; gender: string; age: string };
  /** "YYYY-MM-DD HH:mm:ss" as the machine recorded it. */
  scannedAt: string;
  overallScore: number | null;
  /** Four-letter skin type code from the machine, e.g. "ORPW". */
  skinTypeCode: string;
  /** How many analyses the machine has recorded for this person. */
  scanCount: number;
  scores: ScoreRow[];
  photoUrls: Record<View, string | null>;
};

const str = (v: unknown, max = 80) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "";
const num = (v: unknown): number | null => {
  const text = str(v);
  const n = text === "" ? NaN : Number(text);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const list = (v: unknown) =>
  (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object");

/** Turns the machine's `data.data` object into what SkinFit shows. Phone and avatar are dropped. */
export function readMedixoraData(data: unknown): MedixoraReport {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const customer = (d.Customer && typeof d.Customer === "object" ? d.Customer : {}) as Record<string, unknown>;

  const rows = new Map<string, ScoreRow>();
  for (const item of list(d.ResultDetail)) {
    const name = str(item.Name);
    const view = VIEWS.find((v) => FACE_TYPE[v] === str(item.FaceType));
    const score = num(item.Score);
    if (!name || !view || score == null) continue;
    const row = rows.get(name) ?? { name, front: null, left: null, right: null };
    row[view] = score;
    rows.set(name, row);
  }
  const rank = (n: string) => {
    const i = SCORE_ORDER.indexOf(n);
    return i < 0 ? SCORE_ORDER.length : i;
  };

  const photos = list(d.CollectImage);
  const photo = (view: View) => {
    const hit = photos.find(
      (p) => str(p.FaceType) === FACE_TYPE[view] && str(p.LightType) === WHITE_LIGHT_TYPE
    );
    const url = typeof hit?.Pic === "string" ? hit.Pic : "";
    return url && isAllowedPhotoUrl(url) ? url : null;
  };

  return {
    customer: {
      name: str(customer.Name),
      gender: str(customer.Sex, 16),
      age: str(customer.Age, 3),
    },
    scannedAt: str(d.DeviceCreateTime, 19) || str(d.ServerCreateTime, 19),
    overallScore: num(d.Score),
    skinTypeCode: str(d.LevelName, 8).toUpperCase(),
    scanCount: num(customer.Count) ?? 0,
    scores: [...rows.values()].sort((a, b) => rank(a.name) - rank(b.name)),
    photoUrls: { front: photo("front"), left: photo("left"), right: photo("right") },
  };
}

/** A report with no front photo or no scores is not worth saving. */
export function reportProblem(report: MedixoraReport): string | null {
  if (!report.photoUrls.front) return "This report has no front white-light photo.";
  if (report.scores.length === 0) return "This report has no scores.";
  return null;
}

/**
 * Does the name on the machine look like the chosen patient? "unknown" when the machine hides
 * or omits the name, so staff are asked to check.
 */
export function nameMatch(machineName: string, patientName: string): "match" | "different" | "unknown" {
  if (!machineName || machineName.includes("*")) return "unknown";
  const words = (s: string) =>
    s.toLowerCase().replace(/\b(mr|mrs|ms|miss|dr)\b\.?/g, " ").split(/[^\p{L}]+/u).filter((w) => w.length > 1);
  const a = words(machineName);
  const b = words(patientName);
  if (a.length === 0 || b.length === 0) return "unknown";
  return a.some((w) => b.includes(w)) ? "match" : "different";
}

export function formatScanDate(scannedAt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(scannedAt);
  if (!m) return "-";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}
