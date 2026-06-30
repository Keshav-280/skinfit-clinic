import { decodeQrFromPdf, parseReportUrlParams } from "./decodeQr";
import {
  customerFromApi,
  fetchSdetectApiReport,
} from "./fetchApiReport";
import { parseSdetectPdfText } from "./parsePdfText";
import type { SdetectMetric, SdetectReportData } from "./types";

function mergePatient(
  pdfPatient: SdetectReportData["patient"],
  apiPatient: SdetectReportData["patient"]
): SdetectReportData["patient"] {
  const masked = (value: string) => value.includes("*");
  return {
    name: masked(apiPatient.name) && !masked(pdfPatient.name) ? pdfPatient.name : apiPatient.name,
    gender: apiPatient.gender !== "—" ? apiPatient.gender : pdfPatient.gender,
    age: apiPatient.age || pdfPatient.age,
    phone: masked(apiPatient.phone) && !masked(pdfPatient.phone) ? pdfPatient.phone : apiPatient.phone,
    reportDate: pdfPatient.reportDate !== "—" ? pdfPatient.reportDate : apiPatient.reportDate,
    scanFrequency: apiPatient.scanFrequency || pdfPatient.scanFrequency,
  };
}

function preferMetrics(
  primary: SdetectMetric[],
  fallback: SdetectMetric[]
): SdetectMetric[] {
  if (primary.length >= fallback.length) return primary;
  const byLabel = new Map(primary.map((m) => [m.label, m.score]));
  return fallback.map((m) => ({
    label: m.label,
    score: byLabel.get(m.label) ?? m.score,
  }));
}

export async function buildSdetectReportFromPdf(
  pdfBuffer: Buffer
): Promise<SdetectReportData> {
  const parsed = await parseSdetectPdfText(pdfBuffer);
  const qrUrl = await decodeQrFromPdf(pdfBuffer);
  const params = qrUrl ? parseReportUrlParams(qrUrl) : null;

  let faceImages: SdetectReportData["faceImages"] = null;
  const sourceReportUrl = qrUrl;
  const reportSn: string | null = params?.reportSn ?? null;

  let classification = parsed.classification;
  let moisture = parsed.moisture;
  let comprehensiveScore = parsed.comprehensiveScore;
  let patient = parsed.patient;
  let radar = parsed.radar;
  let generalAnalysis = parsed.generalAnalysis;
  let inDepthAnalysis = parsed.inDepthAnalysis;
  let issueAnalysis = parsed.issueAnalysis;
  let skincareAdvice = parsed.skincareAdvice;

  if (params) {
    try {
      const api = await fetchSdetectApiReport(
        params.apiBase,
        params.reportSn,
        params.token
      );
      faceImages = api.faceImages;
      classification = api.classification || classification;
      moisture = api.moisture || moisture;
      comprehensiveScore = api.comprehensiveScore || comprehensiveScore;
      patient = mergePatient(parsed.patient, customerFromApi(api.report, api.customer));
      radar = preferMetrics(api.radar, parsed.radar);
      generalAnalysis = preferMetrics(api.generalAnalysis, parsed.generalAnalysis);
      inDepthAnalysis = preferMetrics(api.inDepthAnalysis, parsed.inDepthAnalysis);
      if (api.issueAnalysis) {
        issueAnalysis =
          api.issueAnalysis.length >= issueAnalysis.length
            ? api.issueAnalysis
            : issueAnalysis || api.issueAnalysis;
      }
      if (api.skincareAdvice.length) {
        skincareAdvice =
          api.skincareAdvice.length >= skincareAdvice.length
            ? api.skincareAdvice
            : skincareAdvice.length
              ? skincareAdvice
              : api.skincareAdvice;
      }
    } catch {
      /* keep PDF-only data when API fetch fails */
    }
  }

  return {
    classification,
    moisture,
    comprehensiveScore,
    patient,
    radar,
    issueAnalysis,
    skincareAdvice,
    generalAnalysis,
    inDepthAnalysis,
    faceImages,
    sourceReportUrl,
    reportSn,
  };
}
