import type { SdetectFaceImages, SdetectMetric } from "./types";

type ApiResultDetail = {
  Name?: string;
  Score?: string;
  FaceType?: string;
  FaceTypeName?: string;
};

type ApiCollectImage = {
  FaceType?: string;
  LightName?: string;
  Pic?: string;
};

type ApiCustomer = {
  Name?: string;
  Sex?: string;
  Age?: string;
  Phone?: string;
  Count?: string;
};

type ApiReportPayload = {
  data?: {
    data?: {
      Score?: string;
      LevelName?: string;
      ServerCreateTime?: string;
      Customer?: ApiCustomer;
      ResultDetail?: ApiResultDetail[];
      CollectImage?: ApiCollectImage[];
      ComprehensiveProposal?: Array<{
        title?: string;
        content?: Array<{ content?: string[] }>;
      }>;
    };
    customer?: {
      name?: string;
      sex?: string;
      age?: string;
      phone?: string;
      count?: string;
      updateTime?: string;
    };
  };
};

// FaceType codes: "2" = front, "1" = left, "3" = right.
// Preferred face angle per slot, most-appropriate first.
const FACE_TYPE_PRIORITY: Record<keyof SdetectFaceImages, string[]> = {
  front: ["2", "1", "3"],
  left: ["1", "2", "3"],
  right: ["3", "2", "1"],
};

// Natural-colour photos first; diagnostic overlays (UV, Wood's, polarised, maps)
// only as a last resort so the card never renders a weird greyscale map when a
// real photo exists.
const LIGHT_PRIORITY = ["White light", "White map"];

/**
 * Build a prioritised list of `faceType|light` keys for a slot: preferred angle
 * + natural light first, then any light for the preferred angle, then other
 * angles, and finally anything available.
 */
function candidateKeys(
  slot: keyof SdetectFaceImages,
  available: Map<string, string>
): string[] {
  const keys: string[] = [];
  const push = (k: string) => {
    if (available.has(k) && !keys.includes(k)) keys.push(k);
  };

  const availableLights = new Set(
    [...available.keys()].map((k) => k.split("|")[1])
  );
  const lightsInOrder = [
    ...LIGHT_PRIORITY,
    ...[...availableLights].filter((l) => !LIGHT_PRIORITY.includes(l)),
  ];

  // Preferred angle × natural light, then preferred angle × any light.
  for (const faceType of FACE_TYPE_PRIORITY[slot]) {
    for (const light of lightsInOrder) push(`${faceType}|${light}`);
  }
  // Absolute last resort: literally anything the API returned.
  for (const k of available.keys()) push(k);
  return keys;
}

/**
 * Resolve three face images robustly. Prefers a distinct natural photo per slot,
 * but falls back through every available angle/light combination and will reuse
 * an image rather than show nothing. Returns null only when the API returned no
 * usable images at all.
 */
async function resolveFaceImages(
  byFaceLight: Map<string, string>
): Promise<SdetectFaceImages | null> {
  if (byFaceLight.size === 0) return null;

  const slots: Array<keyof SdetectFaceImages> = ["front", "left", "right"];
  const chosenUrl: Record<keyof SdetectFaceImages, string | null> = {
    front: null,
    left: null,
    right: null,
  };
  const usedUrls = new Set<string>();

  // Pass 1: prefer a distinct image per slot.
  for (const slot of slots) {
    for (const key of candidateKeys(slot, byFaceLight)) {
      const url = byFaceLight.get(key);
      if (url && !usedUrls.has(url)) {
        chosenUrl[slot] = url;
        usedUrls.add(url);
        break;
      }
    }
  }

  // Pass 2: fill any still-empty slot even if it means reusing an image.
  for (const slot of slots) {
    if (chosenUrl[slot]) continue;
    const key = candidateKeys(slot, byFaceLight)[0];
    chosenUrl[slot] = (key && byFaceLight.get(key)) || null;
  }

  const front = chosenUrl.front ?? chosenUrl.left ?? chosenUrl.right;
  const left = chosenUrl.left ?? front;
  const right = chosenUrl.right ?? front;
  if (!front || !left || !right) return null;

  const [frontBuf, leftBuf, rightBuf] = await Promise.all([
    fetchImageBuffer(front),
    fetchImageBuffer(left),
    fetchImageBuffer(right),
  ]);
  return { front: frontBuf, left: leftBuf, right: rightBuf };
}

const RADAR_NAMES = [
  "Superficial pigment",
  "Brown pigment",
  "Mixed spot",
  "Collagen",
  "Sebum",
  "Pores",
  "Blackhead",
  "Acne",
  "Heat Map of Sensitivity",
];

const GENERAL_NAMES = [
  "Sebum",
  "Pores",
  "Blackhead",
  "Superficial pigment",
  "Mixed spot",
  "Acne",
  "Skin Barrier",
  "Wrinkle",
];

const IN_DEPTH_NAMES = [
  "Porphyrin",
  "Deep Pigment",
  "Brown pigment",
  "Heat Map of Pigment",
  "Red Map of Sensitivity",
  "Heat Map of Sensitivity",
  "Collagen",
];

function scoreFromDetail(items: ApiResultDetail[], name: string, faceType = "2"): number | null {
  const row = items.find(
    (item) => item.Name === name && String(item.FaceType ?? "") === faceType
  );
  if (!row?.Score) return null;
  const value = Number.parseFloat(row.Score);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function metricsFromDetails(
  items: ApiResultDetail[],
  names: string[],
  faceType = "2"
): SdetectMetric[] {
  const metrics: SdetectMetric[] = [];
  for (const label of names) {
    const score = scoreFromDetail(items, label, faceType);
    if (score != null) metrics.push({ label, score });
  }
  return metrics;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`image fetch failed: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchSdetectApiReport(
  apiBase: string,
  reportSn: string,
  token: string
): Promise<{
  report: NonNullable<ApiReportPayload["data"]>["data"];
  customer: NonNullable<ApiReportPayload["data"]>["customer"];
  faceImages: SdetectFaceImages | null;
  radar: SdetectMetric[];
  generalAnalysis: SdetectMetric[];
  inDepthAnalysis: SdetectMetric[];
  issueAnalysis: string;
  skincareAdvice: string[];
  moisture: number;
  comprehensiveScore: number;
  classification: string;
}> {
  const body = new URLSearchParams({ report_sn: reportSn, token });
  const res = await fetch(`${apiBase}/api/h5/getreportdata`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`getreportdata HTTP ${res.status}`);
  const payload = (await res.json()) as ApiReportPayload & { success?: boolean };
  if (!payload.success || !payload.data?.data) {
    throw new Error("getreportdata returned no data");
  }

  const report = payload.data.data;
  const customer = payload.data.customer;
  const details = report.ResultDetail ?? [];

  const byFaceLight = new Map<string, string>();
  for (const item of report.CollectImage ?? []) {
    if (item.FaceType && item.LightName && item.Pic) {
      byFaceLight.set(`${item.FaceType}|${item.LightName}`, item.Pic);
    }
  }

  const faceImages = await resolveFaceImages(byFaceLight).catch(() => null);

  const moistureScore = scoreFromDetail(
    details.filter((d) => d.Name === "Moisture"),
    "Moisture",
    "2"
  );

  const proposals = report.ComprehensiveProposal ?? [];
  const issueBlock = proposals.find((p) => /issue/i.test(p.title ?? ""));
  const adviceBlock = proposals.find((p) => /advice|skincare/i.test(p.title ?? ""));

  const issueAnalysis =
    issueBlock?.content?.[0]?.content?.join(" ").trim() ??
    issueBlock?.content?.flatMap((c) => c.content ?? []).join(" ").trim() ??
    "";

  const skincareAdvice =
    adviceBlock?.content?.flatMap((c) => c.content ?? []).filter(Boolean) ?? [];

  return {
    report,
    customer,
    faceImages,
    radar: metricsFromDetails(details, RADAR_NAMES, "2"),
    generalAnalysis: metricsFromDetails(details, GENERAL_NAMES, "2"),
    inDepthAnalysis: metricsFromDetails(details, IN_DEPTH_NAMES, "2"),
    issueAnalysis,
    skincareAdvice,
    moisture: moistureScore ?? 0,
    comprehensiveScore: Number.parseInt(report.Score ?? "0", 10) || 0,
    classification: report.LevelName ?? "—",
  };
}

export function customerFromApi(
  report: NonNullable<ApiReportPayload["data"]>["data"],
  customer: NonNullable<ApiReportPayload["data"]>["customer"]
) {
  const c = report?.Customer;
  return {
    name: customer?.name ?? c?.Name ?? "—",
    gender: customer?.sex ?? c?.Sex ?? "—",
    age: Number.parseInt(customer?.age ?? c?.Age ?? "0", 10) || 0,
    phone: customer?.phone ?? c?.Phone ?? "—",
    reportDate:
      customer?.updateTime?.slice(0, 10) ??
      report?.ServerCreateTime?.slice(0, 10) ??
      "—",
    scanFrequency:
      Number.parseInt(c?.Count ?? customer?.count ?? "0", 10) || 0,
  };
}
