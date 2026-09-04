import { format } from "date-fns";
import type { KaiGradeTone, KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { scoreFinding, subGradeTone } from "@/src/lib/kaiReportMapping";
import {
  addDays,
  computeScore10Movement,
  intervalDaysForParam,
  isMovementReportable,
  TRACKING_RATIONALE,
  type MovementKind,
} from "@/src/lib/report/gradeComputation";
import { scoreOutOfTen } from "@/src/lib/clarityGrade";

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
  declined: MovementRow[];
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
}): MovementGroups {
  const prevByKey = new Map(opts.previous.map((p) => [p.key, p]));
  const daysSinceFirst = Math.floor(
    (opts.currentScanAt.getTime() - opts.firstScanAt.getTime()) /
      (24 * 60 * 60 * 1000)
  );

  const improved: MovementRow[] = [];
  const declined: MovementRow[] = [];
  const holding: MovementRow[] = [];
  const tracking: MovementRow[] = [];

  for (const curr of opts.current) {
    if (!isMovementReportable(curr.key, daysSinceFirst)) {
      const next = addDays(opts.firstScanAt, intervalDaysForParam(curr.key));
      const nextLabel = format(next, "d MMM");
      const rationale =
        TRACKING_RATIONALE[curr.key] ??
        "This marker reports on a longer cycle - keep scanning so we have a clean comparison.";
      tracking.push({
        key: curr.key,
        name: curr.name,
        grade: curr.grade,
        gradeColor: curr.gradeColor,
        finding: scoreFinding(curr.name, curr.score10),
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
        finding: scoreFinding(curr.name, curr.score10),
        movement: { tag: "Mapped", type: "hold" },
      });
      continue;
    }

    const kind = computeScore10Movement(curr.score10, prev.score10);
    const mv = arrowTag(String(prev.score10), String(curr.score10), kind);
    const row: MovementRow = {
      key: curr.key,
      name: curr.name,
      grade: curr.grade,
      gradeColor: curr.gradeColor,
      finding: scoreFinding(curr.name, curr.score10, prev.score10),
      movement: mv,
    };

    if (kind === "holding") {
      holding.push(row);
    } else if (kind === "declined") {
      declined.push(row);
    } else {
      improved.push(row);
    }
  }

  return { improved, declined, holding, tracking };
}

export function overallMovementFromScores(
  currentScore: number,
  previousScore: number
): MovementKind {
  return computeScore10Movement(
    scoreOutOfTen(currentScore),
    scoreOutOfTen(previousScore)
  );
}

export function toneFromLetter(letter: string): KaiGradeTone {
  return subGradeTone(letter);
}
