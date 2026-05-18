/** Split API focus copy into bold headline + normal detail (dashboard). */
export function splitTodayFocusMessage(message: string): {
  headline: string;
  detail: string;
} {
  const trimmed = message.trim();
  const lines = trimmed
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return { headline: lines[0], detail: lines.slice(1).join(" ") };
  }
  const sentenceBreak = trimmed.match(/^(.+?[.!?])(\s+)(.+)$/);
  if (sentenceBreak?.[1] && sentenceBreak[3]) {
    return { headline: sentenceBreak[1].trim(), detail: sentenceBreak[3].trim() };
  }
  return { headline: trimmed, detail: "" };
}
