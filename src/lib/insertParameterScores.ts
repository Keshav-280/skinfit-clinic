import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import {
  type KaiParamKey,
  KAI_PARAM_KEYS,
  type KaiParamSource,
} from "@/src/lib/kaiParameters";

type ParamRow = {
  value: number | null;
  source: KaiParamSource;
  severityFlag?: boolean;
  deltaVsPrev?: number | null;
  extras?: Record<string, unknown> | null;
};

type Db = typeof db;

export async function insertParameterScoresForScan(
  d: Db,
  scanId: number,
  byKey: Partial<Record<KaiParamKey, ParamRow>>
) {
  const rows = KAI_PARAM_KEYS.map((key) => {
    const row = byKey[key];
    return {
      scanId,
      paramKey: key,
      value: row?.value ?? null,
      source: (row?.source ?? "pending") as (typeof schema.parameterScores.$inferInsert)["source"],
      severityFlag: row?.severityFlag ?? false,
      deltaVsPrev: row?.deltaVsPrev ?? null,
      extras: row?.extras ?? null,
    };
  });

  await d.insert(schema.parameterScores).values(rows);
}

/** Merge inference v2 params (ai|pending) into DB rows; doctor overrides applied later. */
export function inferenceParamsToRows(
  params: Record<
    string,
    { value: number | null; source: string; severity_flag?: boolean; extras?: unknown }
  >
): Partial<Record<KaiParamKey, ParamRow>> {
  const out: Partial<Record<KaiParamKey, ParamRow>> = {};
  for (const key of KAI_PARAM_KEYS) {
    const p = params[key];
    if (!p) {
      out[key] = { value: null, source: "pending" };
      continue;
    }
    const src =
      p.source === "ai" ? "ai" : p.source === "doctor" ? "doctor" : "pending";
    out[key] = {
      value: typeof p.value === "number" ? p.value : null,
      source: src,
      severityFlag: Boolean(p.severity_flag),
      extras:
        p.extras && typeof p.extras === "object"
          ? (p.extras as Record<string, unknown>)
          : null,
    };
  }
  return out;
}

export async function deleteParameterScoresForScan(d: Db, scanId: number) {
  await d
    .delete(schema.parameterScores)
    .where(eq(schema.parameterScores.scanId, scanId));
}
