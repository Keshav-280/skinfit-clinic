export interface ReportRegion {
  issue: string;
  coordinates: { x: number; y: number };
}

export interface ReportMetrics {
  acne: number;
  hydration: number;
  wrinkles: number;
  overall_score: number;
}
