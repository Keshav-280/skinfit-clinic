import { decodeQrFromPdf, parseReportUrlParams } from "./decodeQr";
import {
  customerFromApi,
  fetchSdetectApiReport,
} from "./fetchApiReport";
import { parseSdetectPdfText } from "./parsePdfText";
import type { SdetectMetric, SdetectReportData } from "./types";
import { extractReportWithVision } from "./visionExtract";

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
    scanFrequency: pdfPatient.scanFrequency || apiPatient.scanFrequency,
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

  // Vision-OCR fallback: when text extraction (and API) left key fields empty —
  // scanned/image-only PDFs, unknown layouts, other languages — render the pages
  // and let a vision model read the printed values. Only fills what's missing.
  const needsVision =
    patient.name === "—" ||
    comprehensiveScore === 0 ||
    classification === "—" ||
    radar.length < 5;

  if (needsVision) {
    const vision = await extractReportWithVision(pdfBuffer).catch(() => null);

    if (vision) {
      if (patient.name === "—" && vision.patient.name) patient.name = vision.patient.name;
      if (patient.gender === "—" && vision.patient.gender) patient.gender = vision.patient.gender;
      if (!patient.age && vision.patient.age) patient.age = vision.patient.age;
      if (patient.phone === "—" && vision.patient.phone) patient.phone = vision.patient.phone;
      if (patient.reportDate === "—" && vision.patient.reportDate) patient.reportDate = vision.patient.reportDate;
      if (!patient.scanFrequency && vision.patient.scanFrequency) patient.scanFrequency = vision.patient.scanFrequency;
      if (classification === "—" && vision.classification) classification = vision.classification;
      if (!moisture && vision.moisture) moisture = vision.moisture;
      if (!comprehensiveScore && vision.comprehensiveScore) comprehensiveScore = vision.comprehensiveScore;
      radar = preferMetrics(radar, vision.radar);
      generalAnalysis = preferMetrics(generalAnalysis, vision.generalAnalysis);
      inDepthAnalysis = preferMetrics(inDepthAnalysis, vision.inDepthAnalysis);
      if (!issueAnalysis && vision.issueAnalysis) issueAnalysis = vision.issueAnalysis;
      if (!skincareAdvice.length && vision.skincareAdvice.length) skincareAdvice = vision.skincareAdvice;
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
