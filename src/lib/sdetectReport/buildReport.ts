import { decodeQrFromPdf, parseReportUrlParams } from "./decodeQr";
import {
  customerFromApi,
  fetchSdetectApiReport,
} from "./fetchApiReport";
import { parseSdetectPdfText } from "./parsePdfText";
import { reportDebug, reportLog, truncateText } from "./pipelineLog";
import { SDETECT_RADAR_LABELS } from "./radarLabels";
import type { SdetectMetric, SdetectReportData } from "./types";
import { extractReportWithVision, isGarbledPatientName } from "./visionExtract";

function metricSummary(metrics: SdetectMetric[]): Array<{ label: string; score: number }> {
  return metrics.map((m) => ({ label: m.label, score: m.score }));
}

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

const GENERAL_EXPECTED = 8;
const IN_DEPTH_EXPECTED = 7;

function isLowConfidenceParse(state: {
  patient: SdetectReportData["patient"];
  classification: string;
  comprehensiveScore: number;
  radar: SdetectMetric[];
  generalAnalysis: SdetectMetric[];
  inDepthAnalysis: SdetectMetric[];
}): boolean {
  if (isGarbledPatientName(state.patient.name)) return true;
  if (state.classification === "—") return true;
  if (state.comprehensiveScore === 0) return true;
  if (state.radar.length < 8) return true;
  if (state.generalAnalysis.length < 4) return true;
  if (state.classification !== "—" && state.comprehensiveScore === 0) return true;
  const totalMetrics =
    state.radar.length + state.generalAnalysis.length + state.inDepthAnalysis.length;
  const totalExpected =
    SDETECT_RADAR_LABELS.length + GENERAL_EXPECTED + IN_DEPTH_EXPECTED;
  return totalMetrics < totalExpected * 0.5;
}

export async function buildSdetectReportFromPdf(
  pdfBuffer: Buffer,
  options: { sourceFilename?: string } = {}
): Promise<SdetectReportData> {
  reportLog("pdf_received", {
    sourceFilename: options.sourceFilename ?? null,
    bytes: pdfBuffer.length,
  });

  const parsed = await parseSdetectPdfText(pdfBuffer);
  reportLog("text_parse_done", {
    patientName: parsed.patient.name,
    classification: parsed.classification,
    comprehensiveScore: parsed.comprehensiveScore,
    moisture: parsed.moisture,
    radarCount: parsed.radar.length,
    generalCount: parsed.generalAnalysis.length,
    inDepthCount: parsed.inDepthAnalysis.length,
    garbledName: isGarbledPatientName(parsed.patient.name),
  });
  reportDebug("text_parse_radar", { radar: metricSummary(parsed.radar) });
  reportDebug("text_parse_general", { general: metricSummary(parsed.generalAnalysis) });
  reportDebug("text_parse_issue", { issueAnalysis: truncateText(parsed.issueAnalysis, 800) });

  const qrUrl = await decodeQrFromPdf(pdfBuffer);
  const params = qrUrl ? parseReportUrlParams(qrUrl) : null;
  reportLog("qr_decode", {
    decoded: Boolean(qrUrl),
    reportSn: params?.reportSn ?? null,
    hasApiParams: Boolean(params),
  });

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
      reportLog("api_fetch_ok", {
        radarCount: radar.length,
        hasFaces: Boolean(faceImages),
        classification,
        comprehensiveScore,
      });
      reportDebug("api_fetch_radar", { radar: metricSummary(radar) });
    } catch (err) {
      reportLog("api_fetch_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Vision-OCR fallback: scanned/photocopy PDFs often have a broken text layer that
  // parses partially — trigger vision when fields are empty or the parse looks unreliable.
  const lowConfidence = isLowConfidenceParse({
    patient,
    classification,
    comprehensiveScore,
    radar,
    generalAnalysis,
    inDepthAnalysis,
  });

  if (lowConfidence) {
    reportLog("vision_ocr_start", {
      reason: "low_confidence_parse",
      radarCount: radar.length,
      generalCount: generalAnalysis.length,
      classification,
      comprehensiveScore,
    });
    const vision = await extractReportWithVision(pdfBuffer).catch((err) => {
      reportLog("vision_ocr_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    if (vision) {
      reportLog("vision_ocr_ok", {
        patientName: vision.patient.name ?? null,
        classification: vision.classification,
        comprehensiveScore: vision.comprehensiveScore,
        radarCount: vision.radar.length,
        generalCount: vision.generalAnalysis.length,
      });
      reportDebug("vision_ocr_radar", { radar: metricSummary(vision.radar) });
      if (vision.patient.name) patient.name = vision.patient.name;
      if (vision.patient.gender) patient.gender = vision.patient.gender;
      if (vision.patient.age) patient.age = vision.patient.age;
      if (vision.patient.phone) patient.phone = vision.patient.phone;
      if (vision.patient.reportDate) patient.reportDate = vision.patient.reportDate;
      if (vision.patient.scanFrequency) patient.scanFrequency = vision.patient.scanFrequency;
      if (vision.classification) classification = vision.classification;
      if (vision.moisture) moisture = vision.moisture;
      if (vision.comprehensiveScore) comprehensiveScore = vision.comprehensiveScore;
      radar = preferMetrics(vision.radar, radar);
      generalAnalysis = preferMetrics(vision.generalAnalysis, generalAnalysis);
      inDepthAnalysis = preferMetrics(vision.inDepthAnalysis, inDepthAnalysis);
      if (vision.issueAnalysis) issueAnalysis = vision.issueAnalysis;
      if (vision.skincareAdvice.length) skincareAdvice = vision.skincareAdvice;
    }
  } else {
    reportLog("vision_ocr_skipped", { reason: "text_parse_confident" });
  }

  reportLog("extract_complete", {
    patientName: patient.name,
    classification,
    comprehensiveScore,
    radarCount: radar.length,
    radar: metricSummary(radar),
    hasFaces: Boolean(faceImages),
    usedVision: lowConfidence,
  });

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
