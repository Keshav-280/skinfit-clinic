export const SLEEP_QUALITY_VALUES = [
  "very_poor",
  "average",
  "excellent",
] as const;

export type SleepQualityValue = (typeof SLEEP_QUALITY_VALUES)[number];

export type SleepQualityLabel = "Very Poor" | "Average" | "Excellent";

const VALUE_TO_LABEL: Record<SleepQualityValue, SleepQualityLabel> = {
  very_poor: "Very Poor",
  average: "Average",
  excellent: "Excellent",
};

export function normalizeSleepQuality(
  input: unknown,
  fallback: SleepQualityValue | null = null
): SleepQualityValue | null {
  if (input === null || input === undefined) return fallback;
  if (typeof input !== "string") return fallback;
  const raw = input.trim().toLowerCase();
  if (raw === "very_poor" || raw === "very poor") return "very_poor";
  if (raw === "average") return "average";
  if (raw === "excellent") return "excellent";
  return fallback;
}

export function sleepQualityToLabel(
  value: string | null | undefined
): SleepQualityLabel {
  const n = normalizeSleepQuality(value, "average") ?? "average";
  return VALUE_TO_LABEL[n];
}

export function sleepQualityFromLabel(
  label: string
): SleepQualityValue {
  return normalizeSleepQuality(label, "average") ?? "average";
}
