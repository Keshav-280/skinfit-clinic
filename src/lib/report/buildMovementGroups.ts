import { format } from "date-fns";
import type { KaiGradeTone, KaiReportParamRow } from "@/src/lib/kaiReportMapping";
import { scoreFinding, subGradeTone } from "@/src/lib/kaiReportMapping";
import {
  addDays,
  computeScoreMovement,
  intervalDaysForParam,
  isMovementReportable,
  TRACKING_RATIONALE,
  type MovementKind,
} from "@/src/lib/report/gradeComputation";
import { scoreOutOfHundred } from "@/src/lib/clarityGrade";
import {
  computeScoreChange,
  describeScoreChange,
  type ScoreChange,
  type ScorePoint,
} from "@/src/lib/scoreChange";

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

function kindFromChange(change: ScoreChange): MovementKind {
  if (change.direction === "up") return "improved";
  if (change.direction === "down") return "declined";
  return "holding";
}

const COMPARED_WITH = {
  last: "last_scan",
  two_back: "two_scans_ago",
  first: "first_scan",
} as const;

/**
 * Movement handed to the report writer for one parameter, from the same change engine the
 * on-screen tags use, so the narrative and the numbers can never disagree.
 */
export function focusParamMovement(
  series: ScorePoint[] | undefined
): {
  movement: "improved" | "declined" | "holding" | "baseline";
  change_points: number | null;
  compared_with: (typeof COMPARED_WITH)[keyof typeof COMPARED_WITH] | null;
} {
  const change = series ? computeScoreChange(series) : null;
  if (!change) return { movement: "baseline", change_points: null, compared_with: null };
  return {
    movement:
      change.direction === "up" ? "improved" : change.direction === "down" ? "declined" : "holding",
    change_points: change.direction === "steady" ? 0 : change.delta,
    compared_with: COMPARED_WITH[change.horizon],
  };
}

/**
 * Split parameters into Improved, Declined, Holding and Tracking.
 *
 * Movement is judged on the 0-100 score with a minimum detectable change, and compared with the
 * last scan, then two scans back, then the first scan, so slow steady progress shows up. The
 * waiting period for slow-changing markers only applies while nothing measurable has moved:
 * a change that clears the threshold is reported straight away.
 *
 * @param history  per report parameter key, scores oldest → newest, ending with the current scan.
 */
export function buildMovementGroups(opts: {
  current: KaiReportParamRow[];
  previous: KaiReportParamRow[];
  firstScanAt: Date;
  currentScanAt: Date;
  previousScanAt?: Date;
  history?: Record<string, ScorePoint[]>;
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
    const prev = prevByKey.get(curr.key);

    let change: ScoreChange | null = null;
    const series = opts.history?.[curr.key];
    if (series && series.length >= 2) {
      change = computeScoreChange(series);
    } else if (prev) {
      change = computeScoreChange([
        { at: opts.previousScanAt ?? opts.firstScanAt, value: prev.score100 },
        { at: opts.currentScanAt, value: curr.score100 },
      ]);
    }
    const moved = change != null && change.direction !== "steady";

    // Waiting period for slow markers applies only while nothing measurable has moved.
    if (!moved && !isMovementReportable(curr.key, daysSinceFirst)) {
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
        finding: scoreFinding(curr.name, curr.score100),
        movement: { tag: nextLabel, type: "track" },
        note: rationale,
      });
      continue;
    }

    if (!change) {
      holding.push({
        key: curr.key,
        name: curr.name,
        grade: curr.grade,
        gradeColor: curr.gradeColor,
        finding: scoreFinding(curr.name, curr.score100),
        movement: { tag: "Mapped", type: "hold" },
      });
      continue;
    }

    const kind = kindFromChange(change);
    const before = scoreOutOfHundred(curr.score100 - change.delta);
    const mv = arrowTag(String(before), String(curr.score100), kind);
    const row: MovementRow = {
      key: curr.key,
      name: curr.name,
      grade: curr.grade,
      gradeColor: curr.gradeColor,
      finding: scoreFinding(
        curr.name,
        curr.score100,
        kind === "holding" ? curr.score100 : before
      ),
      movement: mv,
      // When the move shows only against an earlier scan, say which one.
      ...(kind !== "holding" && change.horizon !== "last"
        ? { note: describeScoreChange(change) ?? undefined }
        : {}),
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
  return computeScoreMovement(
    scoreOutOfHundred(currentScore),
    scoreOutOfHundred(previousScore)
  );
}

/** Overall movement over the nearest comparison that clears the threshold. */
export function overallMovementFromHistory(series: ScorePoint[]): MovementKind {
  const change = computeScoreChange(series);
  return change ? kindFromChange(change) : "holding";
}

export function toneFromLetter(letter: string): KaiGradeTone {
  return subGradeTone(letter);
}
