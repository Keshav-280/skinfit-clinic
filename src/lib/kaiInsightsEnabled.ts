/**
 * kAI insights (today's focus, weekly RAG copy, monthly RAG report).
 * Off when OPENAI is not configured unless explicitly enabled via KAI_INSIGHTS_ENABLED=1.
 */
export function isKaiInsightsEnabled(): boolean {
  const explicit = process.env.KAI_INSIGHTS_ENABLED?.trim().toLowerCase();
  if (explicit === "0" || explicit === "false" || explicit === "no") return false;
  if (explicit === "1" || explicit === "true" || explicit === "yes") {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
