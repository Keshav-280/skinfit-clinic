import type { ObservationRow } from "@/src/lib/weeklyInsightModel";
import {
  patientClarityToGrade,
  type ClarityGrade,
} from "./clarityGrade";

export type ObservationSource = ObservationRow["source"];

export type ParsedPriorityAction = {
  title: string;
  why?: string;
  do?: string;
  target?: string;
};

const GRADE_RANK: Record<ClarityGrade, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

/** Shown under weekly score/grade so patients know higher = healthier. */
export function scoresUnlockedHint(scoresUnlocked: boolean): string {
  if (scoresUnlocked) {
    return "Higher scores mean healthier skin (0–100).";
  }
  return "Grades A–E: A is best, E needs the most care.";
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim();
}

/** A is best, E is worst — patient-facing trend between two letter grades. */
export function clarityGradeTrendPhrase(
  from: ClarityGrade,
  to: ClarityGrade
): string {
  const diff = GRADE_RANK[to] - GRADE_RANK[from];
  if (diff > 0) return `improved from grade ${from} to ${to}`;
  if (diff < 0) return `slipped from grade ${from} to ${to}`;
  return `held around grade ${to}`;
}

/** Higher raw clarity (0–100) is better skin health. */
export function clarityRawTrendPhrase(from: number, to: number): string {
  const gFrom = patientClarityToGrade(from);
  const gTo = patientClarityToGrade(to);
  if (gFrom !== gTo) return clarityGradeTrendPhrase(gFrom, gTo);
  if (to > from + 2) return "improved slightly";
  if (to < from - 2) return "slipped a little";
  return "held steady";
}

function protectNonScoreTokens(text: string): { text: string; restore: () => string } {
  const protectedMatches: string[] = [];
  const protectRegex =
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b|\b\d+\s+(?:day|week|month|year|hour|glass|visit|scan)[s]?\b|\b\d{1,2}\/10\b/gi;

  const masked = text.replace(protectRegex, (match) => {
    protectedMatches.push(match);
    return `__PROTECTED_${protectedMatches.length - 1}__`;
  });

  return {
    text: masked,
    restore: (s: string) =>
      s.replace(/__PROTECTED_(\d+)__/g, (_m, index) => {
        return protectedMatches[Number(index)] ?? _m;
      }),
  };
}

function fixClarityComparisons(text: string): string {
  let res = text;

  // Fix inverted "improved from 35 to 29" — higher clarity is better.
  res = res.replace(
    /\b(improv(?:ed|ing)|better|stronger|gained|increased|rose)\b([^,.]{0,50}?)\bfrom\s+(\d{1,3})\s+(?:to|down to|into)\s+(\d{1,3})\b/gi,
    (_m, _verb, _mid, a, b) => {
      const from = Number(a);
      const to = Number(b);
      if (from > to && from <= 100 && to >= 0) {
        return clarityRawTrendPhrase(from, to);
      }
      if (from < to && from <= 100 && to <= 100) {
        return clarityRawTrendPhrase(from, to);
      }
      return _m;
    }
  );

  // Worsening language with wrong numeric direction.
  res = res.replace(
    /\b(worsen(?:ed|ing)?|declin(?:ed|ing)|dropped|fell|decreased)\b([^,.]{0,50}?)\bfrom\s+(\d{1,3})\s+(?:to|down to|into)\s+(\d{1,3})\b/gi,
    (_m, _verb, _mid, a, b) => {
      const from = Number(a);
      const to = Number(b);
      if (from <= 100 && to >= 0 && to <= 100) {
        return clarityRawTrendPhrase(from, to);
      }
      return _m;
    }
  );

  // Numeric range comparisons before blind grade substitution.
  res = res.replace(
    /\bfrom\s+(\d{1,3})\s+(?:to|down to|into)\s+(\d{1,3})\b/gi,
    (_m, a, b) => {
      const from = Number(a);
      const to = Number(b);
      if (from <= 100 && to >= 0 && to <= 100) {
        return clarityRawTrendPhrase(from, to);
      }
      return _m;
    }
  );

  // Letter-grade comparisons — rewrite awkward "D is worse than C" phrasing.
  res = res.replace(
    /\bfrom\s+grade\s+([A-E])\s+(?:to|down to|into)\s+grade\s+([A-E])\b/gi,
    (_m, from, to) =>
      clarityGradeTrendPhrase(from as ClarityGrade, to as ClarityGrade)
  );
  res = res.replace(
    /\bgrade\s+([A-E])\s+is\s+(?:worse|lower|poorer|weaker)\s+than\s+(?:grade\s+)?([A-E])\b/gi,
    (_m, worse, better) =>
      `grade ${worse as string} — a step below grade ${better as string}`
  );
  res = res.replace(
    /\bgrade\s+([A-E])\b[^.]{0,24}\bworse\s+than\s+grade\s+([A-E])\b/gi,
    (_m, worse, better) =>
      `grade ${worse as string} — a step below grade ${better as string}`
  );
  res = res.replace(
    /\b(?:slipped|moved|fell)\s+to\s+grade\s+([A-E])\s+from\s+grade\s+([A-E])\b/gi,
    (_m, to, from) =>
      clarityGradeTrendPhrase(from as ClarityGrade, to as ClarityGrade)
  );
  res = res.replace(
    /\bgrade\s+([A-E])\s+to\s+grade\s+([A-E])\b/gi,
    (_m, from, to) =>
      clarityGradeTrendPhrase(from as ClarityGrade, to as ClarityGrade)
  );

  return res;
}

/** Catch phrases that invert clarity direction (higher = better). */
function fixInvertedClaritySemantics(text: string): string {
  let res = text;

  res = res.replace(
    /\b(\d{1,3})\b,\s*which is better than\s+(\d{1,3})\b/gi,
    (_m, a, b) => {
      const x = Number(a);
      const y = Number(b);
      if (x <= 100 && y <= 100 && x < y) {
        return clarityRawTrendPhrase(y, x);
      }
      return _m;
    }
  );

  res = res.replace(
    /\b(?:slip(?:ped|s)?|moved|fell)\s+to\s+grade\s+([A-E]),\s*which is better than\s+grade\s+([A-E])\b/gi,
    (_m, to, from) =>
      clarityGradeTrendPhrase(from as ClarityGrade, to as ClarityGrade)
  );

  res = res.replace(
    /\bgrade\s+([A-E]),\s*which is better than\s+grade\s+([A-E])\b/gi,
    (_m, g1, g2) => {
      const r1 = GRADE_RANK[g1 as ClarityGrade];
      const r2 = GRADE_RANK[g2 as ClarityGrade];
      if (r1 < r2) {
        return clarityGradeTrendPhrase(g2 as ClarityGrade, g1 as ClarityGrade);
      }
      return _m;
    }
  );

  res = res.replace(
    /\b(\d{1,3})\b\s+is\s+better\s+than\s+(\d{1,3})\b/gi,
    (_m, a, b) => {
      const x = Number(a);
      const y = Number(b);
      if (x <= 100 && y <= 100 && x < y) {
        return clarityRawTrendPhrase(y, x);
      }
      return _m;
    }
  );

  res = res.replace(
    /\b(\d{1,3})\b\s+is\s+worse\s+than\s+(\d{1,3})\b/gi,
    (_m, a, b) => {
      const x = Number(a);
      const y = Number(b);
      if (x <= 100 && y <= 100 && x > y) {
        return clarityRawTrendPhrase(y, x);
      }
      return _m;
    }
  );

  res = res.replace(
    /\bgrade\s+([A-E])\s+is\s+better\s+than\s+grade\s+([A-E])\b/gi,
    (_m, g1, g2) => {
      const r1 = GRADE_RANK[g1 as ClarityGrade];
      const r2 = GRADE_RANK[g2 as ClarityGrade];
      if (r1 < r2) {
        return clarityGradeTrendPhrase(g2 as ClarityGrade, g1 as ClarityGrade);
      }
      return _m;
    }
  );

  res = res.replace(
    /\bgrade\s+([A-E])\s+is\s+worse\s+than\s+grade\s+([A-E])\b/gi,
    (_m, g1, g2) => {
      const r1 = GRADE_RANK[g1 as ClarityGrade];
      const r2 = GRADE_RANK[g2 as ClarityGrade];
      if (r1 > r2) {
        return clarityGradeTrendPhrase(g2 as ClarityGrade, g1 as ClarityGrade);
      }
      return _m;
    }
  );

  res = res.replace(
    /\b(lower|smaller|reduced)\s+score\b([^,.]{0,24}?)\b(improv|better|good|positive)\b/gi,
    "lower score$2needs attention"
  );
  res = res.replace(
    /\b(higher|larger|increased)\s+score\b([^,.]{0,24}?)\b(worse|bad|concerning|negative)\b/gi,
    "higher score$2is encouraging"
  );

  return res;
}

function sanitizeLockedNumericLeaks(text: string): string {
  let res = text;
  res = res.replace(/\b\d{1,3}\s*\/\s*100\b/g, "");
  res = res.replace(/[ΔΔ]\s*[+-]?\d{1,3}\b/g, "");
  res = res.replace(/\b(?:kAI |skin )?score(?:s)? (?:of |at )?\d{1,3}\b/gi, "skin grade");
  res = res.replace(/\b(?:at|to|reached|from)\s+\d{1,3}\b/gi, "");
  res = res.replace(/\b\d{1,3}\s+points?\b/gi, "");
  return collapseWhitespace(res);
}

/** Strip dense scores and fix clarity-direction copy for patients. */
export function softenPatientText(text: string, scoresUnlocked = false): string {
  let res = text
    .replace(/\s*\(\d{1,3}(?:\/100)?\)/g, "")
    .replace(/\b(?:(?:a|an)\s+)?kAI score of \d+(?:\/100)?/gi, "your skin grade")
    .replace(/\b(?:(?:a|an)\s+)?score of \d+(?:\/100)?/gi, "your grade")
    .replace(/\boverall (?:skin )?(?:score|grade) (?:is )?[A-E]\b/gi, "overall grade")
    .replace(/\baveraging (\d+(?:\.\d+)?)\/10/gi, "around $1 out of 10")
    .replace(/\s{2,}/g, " ")
    .trim();

  res = fixClarityComparisons(res);
  res = fixInvertedClaritySemantics(res);

  if (!scoresUnlocked) {
    res = sanitizeLockedNumericLeaks(res);

    const { text: masked, restore } = protectNonScoreTokens(res);
    res = masked.replace(/\b([0-9]{1,3})\b/g, (match) => {
      const val = Number(match);
      if (val >= 0 && val <= 100) {
        return `grade ${patientClarityToGrade(val)}`;
      }
      return match;
    });
    res = restore(res);

    // Collapse duplicate grade phrasing from number substitution.
    res = res.replace(/\bgrade grade\b/gi, "grade");
    res = res.replace(
      /\bheld around grade ([A-E]) with a small dip\b/gi,
      "held around grade $1 with a small dip"
    );
    res = collapseWhitespace(res);
  }

  return collapseWhitespace(res);
}

export function parsePriorityAction(
  raw: string,
  scoresUnlocked = false
): ParsedPriorityAction {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const dashSplit = cleaned.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  const title = softenPatientText((dashSplit?.[1] ?? cleaned).trim(), scoresUnlocked);
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

export function trendSummary(
  delta: number,
  scoresUnlocked = true
): { label: string; tone: "up" | "down" | "flat" } {
  if (!scoresUnlocked) {
    if (delta >= 3) return { label: "Moving up", tone: "up" };
    if (delta <= -3) return { label: "Needs a closer look", tone: "down" };
    return { label: "About the same", tone: "flat" };
  }
  if (delta >= 3) return { label: "Improving", tone: "up" };
  if (delta <= -3) return { label: "Needs attention", tone: "down" };
  return { label: "Holding steady", tone: "flat" };
}
