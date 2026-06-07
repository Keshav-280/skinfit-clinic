import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type CaptureExtraTip = {
  icon: IoniconName;
  title: string;
  description: string;
};

export const CAPTURE_EXTRA_TIPS: readonly CaptureExtraTip[] = [
  {
    icon: "sunny-outline",
    title: "Use natural light",
    description: "Best time is daytime near a window",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Keep it consistent",
    description: "All photos should have similar lighting and background",
  },
  {
    icon: "time-outline",
    title: "Be patient",
    description: "Take your time and follow each step carefully",
  },
  {
    icon: "camera-reverse-outline",
    title: "You can retake",
    description: "Retake any photo if you're not satisfied",
  },
] as const;
