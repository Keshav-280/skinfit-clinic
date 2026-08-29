import type { KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import type {
  DetectionRegion,
  ProxyRegion,
  WrinkleLine,
} from "@/src/lib/scanDetectionRegions";
import type { ConceptReportData } from "@/components/report/concepts/conceptTypes";
import { watchTitle } from "@/components/report/reportCopy";

export const PREVIEW_FACE = "/preview/report-face.svg";

export const previewParameters: KaiReportParamRow[] = [
  {
    key: "active_acne",
    name: "Active acne",
    shortName: "Acne",
    severity: 3.2,
    grade: "5",
    score10: 5,
    gradeColor: "mid",
    finding:
      "Scattered papules on the cheeks and chin — this is the marker to treat first.",
    concernChipId: "acne",
  },
  {
    key: "pigmentation",
    name: "Pigmentation",
    shortName: "Pigment",
    severity: 2.8,
    grade: "6",
    score10: 6,
    gradeColor: "mid",
    finding:
      "Mild-moderate pigment on the malar area. UV control will move this fastest.",
    concernChipId: "pigmentation",
  },
  {
    key: "wrinkles",
    name: "Fine lines",
    shortName: "Wrinkles",
    severity: 2.1,
    grade: "7",
    score10: 7,
    gradeColor: "mid",
    finding:
      "Fine lines around the eyes — expected for this capture, not the lead concern.",
    concernChipId: "wrinkles",
  },
  {
    key: "under_eye",
    name: "Under-eye",
    shortName: "Under-eye",
    severity: 2.4,
    grade: "7",
    score10: 7,
    gradeColor: "mid",
    finding: "Soft shadow under both eyes. Sleep and barrier care before actives.",
    concernChipId: "under_eye",
  },
  {
    key: "acne_scars",
    name: "Acne scarring",
    shortName: "Scars",
    severity: 2.0,
    grade: "8",
    score10: 8,
    gradeColor: "good",
    finding:
      "Shallow texture on the mid-cheek. Clinic options later — not this week.",
    concernChipId: "acne_scars",
  },
  {
    key: "skin_quality",
    name: "Skin quality",
    shortName: "Quality",
    severity: 1.6,
    grade: "9",
    score10: 9,
    gradeColor: "good",
    finding: "Overall quality holds. Keep the barrier calm while acne is treated.",
    concernChipId: null,
  },
];

function acne(x: number, y: number, r: number): DetectionRegion {
  return {
    class: "papule",
    display_class: "Acne",
    confidence: 0.82,
    center_pct: [x, y],
    radius_pct: r,
    bbox_pct: [x - r, y - r, x + r, y + r],
  };
}

export const previewDetections: DetectionRegion[] = [
  acne(38, 52, 2.2),
  acne(41, 58, 1.6),
  acne(62, 51, 2.0),
  acne(65, 57, 1.4),
  acne(50, 68, 1.8),
  acne(47, 63, 1.3),
];

export const previewProxies: ProxyRegion[] = [
  {
    type: "ellipse",
    class: "under_eye",
    center_pct: [42, 45],
    rx_pct: 8,
    ry_pct: 3.5,
    score: 2.4,
    opacity: 0.55,
    proxy: true,
  },
  {
    type: "ellipse",
    class: "under_eye",
    center_pct: [58, 45],
    rx_pct: 8,
    ry_pct: 3.5,
    score: 2.4,
    opacity: 0.55,
    proxy: true,
  },
  {
    type: "ellipse",
    class: "pigmentation",
    center_pct: [38, 54],
    rx_pct: 10,
    ry_pct: 8,
    score: 2.8,
    opacity: 0.4,
    proxy: true,
  },
  {
    type: "ellipse",
    class: "acne_scars",
    center_pct: [62, 56],
    rx_pct: 9,
    ry_pct: 7,
    score: 2.0,
    opacity: 0.35,
    proxy: true,
  },
];

export const previewWrinkles: WrinkleLine[] = [
  {
    type: "polyline",
    class: "wrinkle",
    points_pct: [
      [32, 42],
      [38, 44],
      [44, 43],
    ],
    length_pct: 12,
  },
  {
    type: "polyline",
    class: "wrinkle",
    points_pct: [
      [56, 43],
      [62, 44],
      [68, 42],
    ],
    length_pct: 12,
  },
];

export const previewScanImages = [
  { url: PREVIEW_FACE, label: "Front profile", poseId: "centre" },
  { url: PREVIEW_FACE, label: "Left", poseId: "left" },
  { url: PREVIEW_FACE, label: "Right", poseId: "right" },
];

export const previewActions = [
  "Switch to a cream cleanser if you use a foaming wash — over-drying often worsens breakouts.",
  "Sunscreen at 9am, reapply by early afternoon. UV drives post-acne marks as much as new lesions.",
  "Don't start a new active before your consult — sequencing matters more than stacking.",
];

export const previewConceptData: ConceptReportData = {
  grade: "6",
  position: 62,
  dateLabel: "28 Aug 2026",
  title: watchTitle(previewParameters),
  takeaway:
    "Acne and pigment are the two to watch. On Indian skin that mix is often UV plus a dry barrier — keep the routine simple until the next scan.",
  actions: previewActions,
  parameters: previewParameters,
  faceUrl: PREVIEW_FACE,
  detectionRegions: previewDetections,
  proxyRegions: previewProxies,
  wrinkleLines: previewWrinkles,
  doctorName: "Dr. Ruby",
};
