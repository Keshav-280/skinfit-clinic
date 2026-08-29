import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";

export type ConceptReportData = {
  grade: string;
  position: number;
  dateLabel: string;
  title: string;
  takeaway: string;
  actions: string[];
  parameters: KaiReportParamRow[];
  faceUrl: string;
  detectionRegions: DetectionRegion[];
  proxyRegions: ProxyRegion[];
  wrinkleLines: WrinkleLine[];
  doctorName: string;
};
