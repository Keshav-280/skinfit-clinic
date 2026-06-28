/**
 * Patient-facing tracker copy when clinic scores are locked — strip exact
 * numeric scores/deltas so UI shows qualitative language only.
 */

import type {
  PatientTrackerCause,
  PatientTrackerFocusAction,
  PatientTrackerReport,
} from "./patientTrackerReport.types";
import { humanizeReportLine } from "./trackerReportNarrative";

type CauseTone = "win" | "drag" | "watch" | "neutral";

function collapseWhitespace(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s+\./g, ".")
    .trim();
}

function fixGrammar(s: string) {
  return s
    .replace(/\ban manageable\b/gi, "manageable")
    .replace(/\bdue to an manageable\b/gi, "thanks to manageable")
    .replace(/\bdue to an average\b/gi, "thanks to")
    .replace(/\bled to a declined in\b/gi, "may have affected")
    .replace(/\bled to a declined\b/gi, "may have slowed progress on")
    .replace(/\bled to declined in\b/gi, "may have affected")
    .replace(/\bdeclined in\b/gi, "affected")
    .replace(/\ba improved\b/gi, "improved")
    .replace(/\ba affected\b/gi, "affected")
    .replace(/\s+,\s*,/g, ",")
    .replace(/\.\s*\./g, ".");
}

/** Strip score-like numbers from narrative sentences. */
function sanitizeNumericLeaks(text: string, tone: CauseTone): string {
  let s = text;

  s = s.replace(
    /\b(?:remained |stayed |held )?stable at \d{1,3}\b/gi,
    "held steady"
  );
  s = s.replace(
    /\b(?:maintain(?:ed)?|kept) (?:skin quality|pigmentation|[^,.]+) at \d{1,3}\b/gi,
    "helped protect skin tone and quality"
  );
  s = s.replace(/\b(?:at|to|reached) \d{1,3}\b/gi, "");
  s = s.replace(
    /\b(?:significant |noticeable )?(?:drop|dropped|decline|decrease|fall)(?:\s+of)? \d{1,3}(?:\s+points?)?(?:\s+in)?\b/gi,
    tone === "drag" ? "may have slowed progress on" : "shifted"
  );
  s = s.replace(
    /\b(?:increase|increased|gain|gained|rise|rose|improved)(?:\s+by)? \d{1,3}(?:\s+points?)?\b/gi,
    "improved"
  );
  s = s.replace(/[ΔΔ]\s*[+-]?\d{1,3}\b/g, "");
  s = s.replace(/\b\d{1,3}\s*\/\s*100\b/g, "");
  s = s.replace(/\bscore(?:s)? (?:of |at )?\d{1,3}\b/gi, "");
  s = s.replace(/\b\d{1,3}\s+points?\b/gi, "");
  s = s.replace(
    /\b(?:average |avg )?stress(?: level)?(?: of)? \d{1,2}\/10\b/gi,
    "manageable stress levels"
  );
  s = s.replace(/\b\d{1,2}\/10\b/g, "");
  s = s.replace(/\b~?\d{1,3}%/g, "");
  s = s.replace(/\bon \d+\/\d+ days\b/gi, "on several days");
  s = s.replace(/\b\d+\/\d+ days\b/gi, "several days");
  s = s.replace(/\b\d+\/\d+ full-routine days\b/gi, "several full-routine days");
  s = s.replace(/\bonly \d+\/\d+ days\b/gi, "only on some days");
  s = s.replace(/\bcompleted only \d+\/\d+ days\b/gi, "was missed on several days");

  return collapseWhitespace(fixGrammar(s));
}

/** Rewrite frequent LLM / rule-based cause templates into plain qualitative copy. */
function rewriteKnownCausePatterns(body: string, tone: CauseTone): string {
  const lower = body.toLowerCase();

  if (tone === "win") {
    if (/active acne/.test(lower) && /stress/.test(lower)) {
      return "Active acne held steady, likely helped by manageable stress levels.";
    }
    if (
      (/pigmentation|skin quality|uv|photo/.test(lower) && tone === "win") ||
      (/no high-uv|zero high-uv|low-uv/.test(lower) &&
        /pigmentation|skin quality/.test(lower))
    ) {
      return "Lower UV exposure helped protect pigmentation and skin quality.";
    }
    if (/full-routine|routine days/.test(lower)) {
      return "Sticking to your routine supported this area.";
    }
    if (/sleep|hydration|water/.test(lower)) {
      return "Healthy sleep and hydration habits supported your skin this week.";
    }
  }

  if (tone === "drag") {
    if (/incomplete routine|routine was incomplete|missed/.test(lower)) {
      if (/sagging|volume|wrinkle/.test(lower)) {
        return "An inconsistent routine may have slowed progress on sagging and volume.";
      }
      if (/acne|pigment|wrinkle|under.?eye/.test(lower)) {
        return "Missed routine days may have made this area harder to keep steady.";
      }
      return "An inconsistent routine may have held back your weekly progress.";
    }
    if (/stress|sleep|hydration|uv|sun/.test(lower)) {
      return "Lifestyle stressors this week may have made recovery a little harder.";
    }
  }

  if (tone === "watch") {
    if (/routine|journal|sleep|hydration/.test(lower)) {
      return "Small daily habits will matter most before your next scan.";
    }
  }

  return body;
}

function polishCauseBody(body: string, tone: CauseTone): string {
  const stripped = sanitizeNumericLeaks(body, tone);
  const rewritten = rewriteKnownCausePatterns(stripped, tone);
  return collapseWhitespace(fixGrammar(rewritten));
}

export function sanitizeTrackerCauseForLockedPatient(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^(Win|Drag|Watch):\s*(.*)$/i);
  if (!m) {
    return polishCauseBody(trimmed, "neutral");
  }

  const prefix = m[1]!;
  const tone = prefix.toLowerCase() as CauseTone;
  let body = polishCauseBody(m[2] ?? "", tone === "watch" ? "neutral" : tone);

  if (!body || body.length < 8) {
    if (tone === "win") body = "This area held steady or improved.";
    else if (tone === "drag") body = "This area needs a bit more consistency.";
    else body = "Worth keeping an eye on before your next scan.";
  }

  const label = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
  return `${label}: ${body}`;
}

export function sanitizeTrackerNarrativeForLockedPatient(text: string): string {
  const cleaned = humanizeReportLine(text);
  let out = sanitizeNumericLeaks(cleaned, "neutral");
  out = fixGrammar(out);

  out = out.replace(
    /\bremained stable\b/gi,
    "held steady"
  );
  out = out.replace(
    /\blow-stress levels\b/gi,
    "manageable stress levels"
  );
  out = out.replace(
    /\bthe incomplete routine has impacted\b/gi,
    "an inconsistent routine may have affected"
  );
  out = out.replace(
    /\bthe an inconsistent\b/gi,
    "an inconsistent"
  );
  out = out.replace(
    /\bdropped \d+|declined \d+/gi,
    "changed"
  );

  return collapseWhitespace(out) || cleaned;
}

export function sanitizeTrackerCausesForLockedPatient(
  causes: PatientTrackerCause[]
): PatientTrackerCause[] {
  return causes.map((c) => ({
    ...c,
    text: sanitizeTrackerCauseForLockedPatient(c.text),
  }));
}

/** Strip exact scores/deltas from a focus action's Why/Do/Target detail. */
function sanitizeFocusActionDetailForLockedPatient(detail: string): string {
  return detail
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const m = trimmed.match(/^(Why|Do|Target):\s*(.*)$/i);
      if (!m) return collapseWhitespace(sanitizeNumericLeaks(trimmed, "neutral"));
      const label = m[1]!;
      let body = sanitizeNumericLeaks(m[2] ?? "", "neutral");
      body = body
        .replace(/\b(?:reach|hit|get to|climb to|move to)\s+\d{1,3}\b/gi, "improve")
        .replace(/\bby next (?:scan|week)\b/gi, "by your next scan");
      body = collapseWhitespace(body);
      if (!body || body.length < 4) {
        body =
          label.toLowerCase() === "target"
            ? "Aim for steady improvement by your next scan."
            : "Keep this habit consistent.";
      }
      return `${label}: ${body}`;
    })
    .filter(Boolean)
    .join("\n");
}

function sanitizeFocusActionsForLockedPatient(
  actions: PatientTrackerFocusAction[]
): PatientTrackerFocusAction[] {
  return actions.map((a) => ({
    ...a,
    detail: sanitizeFocusActionDetailForLockedPatient(a.detail),
  }));
}

/**
 * Remove letter-grade language (A–E) from AI prose. Unlocked patients see exact
 * numbers, locked patients see qualitative words — neither should read like
 * "you're a solid B". Conservative patterns to avoid hitting "vitamin C" etc.
 */
export function stripLetterGradeLanguage(text: string): string {
  let s = text ?? "";
  s = s.replace(
    /\b(?:a |an )?(?:solid|strong|healthy|comfortable|great|good)\s+[A-E]\b/g,
    "in good shape"
  );
  s = s.replace(/\bgrade[ds]?\s+[A-E]\b/gi, "this level");
  s = s.replace(/\b[A-E][-–]\s*grade\b/gi, "this level");
  s = s.replace(
    /\b(?:sitting at|rated|scored|came in at|landed at)\s+(?:a |an )?[A-E]\b/gi,
    "steady"
  );
  s = s.replace(
    /\b(?:a |an )\s?[A-E]\b(?=\s+(?:overall|this week|range|skin|on your))/g,
    "well-balanced"
  );
  return collapseWhitespace(s);
}

/**
 * Single source of truth for what AI prose a patient sees in the tracker report.
 * - Locked (not visited): strip exact scores/deltas → qualitative copy.
 * - Always: strip letter-grade language (unlocked shows numbers, not grades).
 */
export function presentTrackerReportNarrative(
  report: PatientTrackerReport,
  scoresUnlocked: boolean
): PatientTrackerReport {
  const hookSentence = stripLetterGradeLanguage(
    scoresUnlocked
      ? report.hookSentence
      : sanitizeTrackerNarrativeForLockedPatient(report.hookSentence)
  );
  const insightText = stripLetterGradeLanguage(
    scoresUnlocked
      ? report.insightText
      : sanitizeTrackerNarrativeForLockedPatient(report.insightText)
  );
  const predictionText = stripLetterGradeLanguage(
    scoresUnlocked
      ? report.predictionText
      : sanitizeTrackerNarrativeForLockedPatient(report.predictionText)
  );
  const causes: PatientTrackerCause[] = (
    scoresUnlocked
      ? report.causes
      : sanitizeTrackerCausesForLockedPatient(report.causes)
  ).map((c: PatientTrackerCause) => ({
    ...c,
    text: stripLetterGradeLanguage(c.text),
  }));
  const focusActions: PatientTrackerFocusAction[] = (
    scoresUnlocked
      ? report.focusActions
      : sanitizeFocusActionsForLockedPatient(report.focusActions)
  ).map((a: PatientTrackerFocusAction) => ({
    ...a,
    detail: stripLetterGradeLanguage(a.detail),
  }));

  return {
    ...report,
    hookSentence,
    insightText,
    predictionText,
    causes,
    focusActions,
  };
}
