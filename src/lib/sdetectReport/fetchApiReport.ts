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

const FACE_IMAGE_SPECS: Record<keyof SdetectFaceImages, [string, string]> = {
  front: ["2", "White map"],
  left: ["1", "White light"],
  right: ["3", "White light"],
};

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
  faceImages: SdetectFaceImages;
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

  const faceUrls: Record<keyof SdetectFaceImages, string> = {
    front: "",
    left: "",
    right: "",
  };
  for (const [key, [faceType, lightName]] of Object.entries(FACE_IMAGE_SPECS) as Array<
    [keyof SdetectFaceImages, [string, string]]
  >) {
    const url = byFaceLight.get(`${faceType}|${lightName}`);
    if (!url) throw new Error(`missing face image: ${key}`);
    faceUrls[key] = url;
  }

  const [front, left, right] = await Promise.all([
    fetchImageBuffer(faceUrls.front),
    fetchImageBuffer(faceUrls.left),
    fetchImageBuffer(faceUrls.right),
  ]);

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
    faceImages: { front, left, right },
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
