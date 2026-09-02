import type { SdetectFaceImages, SdetectMetric } from "./types";
import { SDETECT_RADAR_LABELS } from "./radarLabels";

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

// FaceType codes: "1" = left profile, "2" = front/centre, "3" = right profile.
// Left/right: natural White light at their angle. Centre: White map (frontal).
const WHITE_LIGHT = "White light";
const WHITE_MAP = "White map";

/** Diagnostic overlays - never used for left/right profile slots. */
const NON_NATURAL_LIGHT_RE =
  /map|uv|wood|polari|heat|red map|brown|pigment|porphyrin|collagen/i;

function isNaturalLight(lightName: string): boolean {
  return !NON_NATURAL_LIGHT_RE.test(lightName);
}

function pickProfileUrl(
  byFaceLight: Map<string, string>,
  faceType: string
): string | null {
  const whiteKey = `${faceType}|${WHITE_LIGHT}`;
  const white = byFaceLight.get(whiteKey);
  if (white) return white;

  for (const [key, url] of byFaceLight) {
    const [ft, light] = key.split("|");
    if (ft === faceType && light && light !== WHITE_LIGHT && isNaturalLight(light)) {
      return url;
    }
  }
  return null;
}

function pickCentreWhiteMapUrl(byFaceLight: Map<string, string>): string | null {
  return byFaceLight.get(`2|${WHITE_MAP}`) ?? null;
}

async function resolveFaceImages(
  byFaceLight: Map<string, string>
): Promise<SdetectFaceImages | null> {
  if (byFaceLight.size === 0) return null;

  const slotUrls: Record<keyof SdetectFaceImages, string | null> = {
    left: pickProfileUrl(byFaceLight, "1"),
    front: pickCentreWhiteMapUrl(byFaceLight),
    right: pickProfileUrl(byFaceLight, "3"),
  };

  const result: SdetectFaceImages = { left: null, front: null, right: null };

  await Promise.all(
    (Object.keys(slotUrls) as Array<keyof SdetectFaceImages>).map(async (slot) => {
      const url = slotUrls[slot];
      if (!url) return;
      try {
        result[slot] = await fetchImageBuffer(url);
      } catch {
        result[slot] = null;
      }
    })
  );

  return result;
}

const RADAR_NAMES = [...SDETECT_RADAR_LABELS];

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
    classification: report.LevelName ?? "-",
  };
}

export function customerFromApi(
  report: NonNullable<ApiReportPayload["data"]>["data"],
  customer: NonNullable<ApiReportPayload["data"]>["customer"]
) {
  const c = report?.Customer;
  return {
    name: customer?.name ?? c?.Name ?? "-",
    gender: customer?.sex ?? c?.Sex ?? "-",
    age: Number.parseInt(customer?.age ?? c?.Age ?? "0", 10) || 0,
    phone: customer?.phone ?? c?.Phone ?? "-",
    reportDate:
      customer?.updateTime?.slice(0, 10) ??
      report?.ServerCreateTime?.slice(0, 10) ??
      "-",
    scanFrequency:
      Number.parseInt(c?.Count ?? customer?.count ?? "0", 10) || 0,
  };
}
