import { patientClarityToGrade } from "../../src/lib/clarityGrade";

export type ObservationSource =
  | "baseline_scan"
  | "daily_logs"
  | "scan_trend"
  | "weekly_report";

export type ParsedPriorityAction = {
  title: string;
  why?: string;
  do?: string;
  target?: string;
};

export function softenPatientText(text: string, scoresUnlocked = false): string {
  let res = text
    .replace(/\s*\(\d{1,3}(?:\/100)?\)/g, "")
    .replace(/\b(?:(?:a|an)\s+)?kAI score of \d+(?:\/100)?/gi, "your skin grade")
    .replace(/\b(?:(?:a|an)\s+)?score of \d+(?:\/100)?/gi, "your grade")
    .replace(/\boverall (?:skin )?(?:score|grade) (?:is )?[A-E]\b/gi, "overall grade")
    .replace(/\baveraging (\d+(?:\.\d+)?)\/10/gi, "around $1 out of 10")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!scoresUnlocked) {
    // Protect dates and durations from being parsed as scores.
    // e.g. "2 June", "28 June", "7 days", "1 day"
    const protectedMatches: string[] = [];
    const protectRegex = /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b|\b\d+\s+(?:day|week|month|year|hour|glass|visit|scan)[s]?\b/gi;
    
    res = res.replace(protectRegex, (match) => {
      protectedMatches.push(match);
      return `__PROTECTED_${protectedMatches.length - 1}__`;
    });

    // Replace other standalone numbers with corresponding grades
    res = res.replace(/\b([0-9]{1,3})\b/g, (match) => {
      const val = Number(match);
      if (val >= 0 && val <= 100) {
        return `grade ${patientClarityToGrade(val)}`;
      }
      return match;
    });

    // Restore protected dates/durations
    res = res.replace(/__PROTECTED_(\d+)__/g, (match, index) => {
      return protectedMatches[Number(index)] ?? match;
    });
  }

  return res;
}

export function parsePriorityAction(raw: string, scoresUnlocked = false): ParsedPriorityAction {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const dashSplit = cleaned.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  const title = (dashSplit?.[1] ?? cleaned).trim();
  const body = (dashSplit?.[2] ?? "").trim();

  const why = body.match(/Why:\s*(.+?)(?=Do:|Target:|$)/i)?.[1]?.trim();
  const doLine = body.match(/Do:\s*(.+?)(?=Target:|Why:|$)/i)?.[1]?.trim();
  const target = body.match(/Target:\s*(.+?)(?=Why:|Do:|$)/i)?.[1]?.trim();

  return {
    title,
    why: why ? softenPatientText(why, scoresUnlocked) : undefined,
    do: doLine ? softenPatientText(doLine, scoresUnlocked) : undefined,
    target: target ? softenPatientText(target, scoresUnlocked) : undefined,
  };
}

export function friendlyObservationTitle(source?: ObservationSource): string {
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
