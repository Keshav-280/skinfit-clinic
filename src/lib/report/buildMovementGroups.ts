import { format } from "date-fns";
import type { KaiGradeTone, KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { subGradeTone, templateFinding } from "@/src/lib/kaiReportMapping";
import {
  addDays,
  computeMovement,
  intervalDaysForParam,
  isMovementReportable,
  severityToSubGrade,
  TRACKING_RATIONALE,
  type MovementKind,
} from "@/src/lib/report/gradeComputation";

export type MovementRow = {
  key: string;
  name: string;
  grade: string;
  gradeColor: KaiGradeTone;
  finding: string;
  movement: { tag: string; type: "up" | "hold" | "track" | "down" };
  note?: string;
};

export type MovementGroups = {
  improved: MovementRow[];
  holding: MovementRow[];
  tracking: MovementRow[];
};

function arrowTag(
  prevGrade: string,
  currGrade: string,
  kind: MovementKind
): { tag: string; type: "up" | "hold" | "down" } {
  if (kind === "improved") {
    return { tag: `↑ ${prevGrade}→${currGrade}`, type: "up" };
  }
  if (kind === "declined") {
    return { tag: `↓ ${prevGrade}→${currGrade}`, type: "down" };
  }
  return { tag: "Steady", type: "hold" };
}

/**
 * Split parameters into Improved (incl. declined), Holding, and Tracking
 * using minimum detectable intervals from first scan.
 */
export function buildMovementGroups(opts: {
  current: KaiReportParamRow[];
  previous: KaiReportParamRow[];
  firstScanAt: Date;
  currentScanAt: Date;
  llmFindings?: Record<string, { finding?: string; movement?: string }>;
}): MovementGroups {
  const prevByKey = new Map(opts.previous.map((p) => [p.key, p]));
  const daysSinceFirst = Math.floor(
    (opts.currentScanAt.getTime() - opts.firstScanAt.getTime()) /
      (24 * 60 * 60 * 1000)
  );

  const improved: MovementRow[] = [];
  const holding: MovementRow[] = [];
  const tracking: MovementRow[] = [];

  for (const curr of opts.current) {
    const llm = opts.llmFindings?.[curr.key];
    const finding = llm?.finding?.trim() || curr.finding;

    if (!isMovementReportable(curr.key, daysSinceFirst)) {
      const next = addDays(opts.firstScanAt, intervalDaysForParam(curr.key));
      const nextLabel = format(next, "d MMM");
      const rationale =
        TRACKING_RATIONALE[curr.key] ??
        "This marker reports on a longer cycle — keep scanning so we have a clean comparison.";
      tracking.push({
        key: curr.key,
        name: curr.name,
        grade: curr.grade,
        gradeColor: curr.gradeColor,
        finding,
        movement: { tag: nextLabel, type: "track" },
        note: rationale,
      });
      continue;
    }

    const prev = prevByKey.get(curr.key);
    if (!prev) {
      holding.push({
        key: curr.key,
        name: curr.name,
        grade: curr.grade,
        gradeColor: curr.gradeColor,
        finding,
        movement: { tag: "Mapped", type: "hold" },
      });
      continue;
    }

    const kind = computeMovement(curr.severity, prev.severity);
    const prevGrade = severityToSubGrade(prev.severity);
    const currGrade = severityToSubGrade(curr.severity);
    const mv = arrowTag(prevGrade, currGrade, kind);
    const row: MovementRow = {
      key: curr.key,
      name: curr.name,
      grade: curr.grade,
      gradeColor: curr.gradeColor,
      finding:
        finding ||
        templateFinding(curr.name, curr.severity),
      movement: mv,
    };

    if (kind === "holding") {
      holding.push(row);
    } else {
      // Improved group also hosts declined rows (with ↓ tag).
      improved.push(row);
    }
  }

  return { improved, holding, tracking };
}

export function overallMovementFromScores(
  currentScore: number,
  previousScore: number
): MovementKind {
  // Higher clarity score = better skin.
  const delta = currentScore - previousScore;
  if (delta > 3) return "improved";
  if (delta < -3) return "declined";
  return "holding";
}

export function toneFromLetter(letter: string): KaiGradeTone {
  return subGradeTone(letter);
}
