import type { ObservationRow } from "@/src/lib/weeklyInsightModel";

export type ParsedPriorityAction = {
  title: string;
  why?: string;
  do?: string;
  target?: string;
};

/** Strip dense scores so copy reads naturally for patients. */
export function softenPatientText(text: string): string {
  return text
    .replace(/\s*\(\d{1,3}(?:\/100)?\)/g, "")
    .replace(/\bkAI score of \d+(?:\/100)?/gi, "your skin grade")
    .replace(/\bscore of \d+(?:\/100)?/gi, "your grade")
    .replace(/\boverall (?:skin )?(?:score|grade) (?:is )?[A-E]\b/gi, "overall grade")
    .replace(/\baveraging (\d+(?:\.\d+)?)\/10/gi, "around $1 out of 10")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parsePriorityAction(raw: string): ParsedPriorityAction {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const dashSplit = cleaned.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  const title = (dashSplit?.[1] ?? cleaned).trim();
  const body = (dashSplit?.[2] ?? "").trim();

  const why = body.match(/Why:\s*(.+?)(?=Do:|Target:|$)/i)?.[1]?.trim();
  const doLine = body.match(/Do:\s*(.+?)(?=Target:|Why:|$)/i)?.[1]?.trim();
  const target = body.match(/Target:\s*(.+?)(?=Why:|Do:|$)/i)?.[1]?.trim();

  return {
    title,
    why: why ? softenPatientText(why) : undefined,
    do: doLine ? softenPatientText(doLine) : undefined,
    target: target ? softenPatientText(target) : undefined,
  };
}

export function friendlyObservationTitle(
  source?: ObservationRow["source"]
): string {
  switch (source) {
    case "baseline_scan":
      return "Where you started";
    case "daily_logs":
      return "Your daily habits";
    case "scan_trend":
      return "How your skin changed";
    case "weekly_report":
      return "This week's highlight";
    default:
      return "Insight";
  }
}

export function formatInsightUnlockDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export function trendSummary(delta: number): { label: string; tone: "up" | "down" | "flat" } {
  if (delta >= 3) return { label: "Improving", tone: "up" };
  if (delta <= -3) return { label: "Needs attention", tone: "down" };
  return { label: "Holding steady", tone: "flat" };
}
