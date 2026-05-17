export interface ReportRegion {
  issue: string;
  coordinates: { x: number; y: number };
}

/** 1–5 style severity scores (e.g. from FaceAnalyzer-style models). */
export interface ClinicalScores {
  active_acne?: number;
  acne_scars?: number;
  skin_quality?: number;
  /** Model wrinkle severity 1–5 (distinct from 0–100 “clarity” donut). */
  wrinkle_severity?: number;
  sagging_volume?: number;
  under_eye?: number;
  hair_health?: number;
  /** When model has no training data for this axis. */
  pigmentation_model?: number | null;
}

export interface ReportMetrics {
  acne: number;
  hydration: number;
  wrinkles: number;
  overall_score: number;
  pigmentation?: number;
  texture?: number;
  clinical_scores?: ClinicalScores;
}
