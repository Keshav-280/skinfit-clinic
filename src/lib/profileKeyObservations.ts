/**
 * Profile key observations — LLM + RAG only (see profileRagInsights.ts).
 * Context gathering lives in profileInsightContext.ts.
 */

export type {
  ProfileObservationSource,
  ProfileObservationItem,
  ProfileWindowMode,
} from "@/src/lib/profileInsightContext";

export {
  gatherProfileInsightContext,
  type ProfileInsightContext,
} from "@/src/lib/profileInsightContext";

import type {
  ProfileObservationItem,
  ProfileWindowMode,
} from "@/src/lib/profileInsightContext";
import { buildProfileKeyObservationsLlm } from "@/src/lib/profileRagInsights";

export type ProfileKeyObservationsPayload = {
  mode: ProfileWindowMode;
  modeLabel: string;
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  logDaysUsed: string[];
  scanDaysUsed: string[];
  baselineScanDateYmd: string | null;
  items: ProfileObservationItem[];
  narrativeText: string | null;
  generatedBy: "llm_rag";
  /** True when OPENAI_API_KEY is missing or the model returned nothing. */
  llmUnavailable: boolean;
};

/** @deprecated Use buildProfileKeyObservationsLlm — kept as alias for imports. */
export async function buildProfileKeyObservations(
  userId: string
): Promise<ProfileKeyObservationsPayload> {
  return buildProfileKeyObservationsLlm(userId);
}
