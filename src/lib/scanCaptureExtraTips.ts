import type { LucideIcon } from "lucide-react";
import { Camera, Clock, Sun, RefreshCw } from "lucide-react";

export type ScanCaptureExtraTip = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const SCAN_CAPTURE_EXTRA_TIPS: ScanCaptureExtraTip[] = [
  {
    icon: Sun,
    title: "Use natural light",
    description: "Best time is daytime near a window.",
  },
  {
    icon: Camera,
    title: "Keep it consistent",
    description: "All photos should have similar lighting and background.",
  },
  {
    icon: Clock,
    title: "Be patient",
    description: "Take your time and follow each step carefully.",
  },
  {
    icon: RefreshCw,
    title: "You can retake",
    description: "Retake any photo if you're not satisfied.",
  },
];
