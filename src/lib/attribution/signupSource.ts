import { sql } from "drizzle-orm";
import { db } from "@/src/db";

/** Cookie set by <SourceCapture /> on the first visit that carries ?src=… */
export const SOURCE_COOKIE_NAME = "skinfit_src";

/**
 * Created on first use (idempotent DDL) so no manual prod migration is needed.
 * Deliberately NOT a column on `users` (manual migrations; a new users column would
 * break every existing query until applied).
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS signup_sources (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    source varchar(64) NOT NULL,
    campaign varchar(64),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS signup_sources_source_idx ON signup_sources (source)`,
];

let ready: Promise<void> | null = null;

export function ensureSignupSourcesSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/** Lower-case letters, digits, dash and underscore only; max 40 chars. */
export function cleanSourceToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return t.length > 0 ? t : null;
}

export function parseSourceCookie(
  value: string | undefined
): { source: string; campaign: string | null } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      s?: unknown;
      c?: unknown;
    };
    const source = cleanSourceToken(parsed.s);
    if (!source) return null;
    return { source, campaign: cleanSourceToken(parsed.c) };
  } catch {
    return null;
  }
}

/**
 * Records where a patient came from, once per user. Users with no tracking link who
 * signed up in the last 14 days are labelled "direct"; older accounts are skipped so
 * existing patients are never mislabelled.
 */
export async function recordSignupSourceIfMissing(
  userId: string,
  cookieValue: string | undefined
): Promise<void> {
  try {
    await ensureSignupSourcesSchema();
    const parsed = parseSourceCookie(cookieValue);
    if (parsed) {
      await db.execute(sql`
        INSERT INTO signup_sources (user_id, source, campaign)
        SELECT ${userId}::uuid, ${parsed.source}, ${parsed.campaign}
        WHERE EXISTS (SELECT 1 FROM users WHERE id = ${userId}::uuid AND role = 'patient')
        ON CONFLICT (user_id) DO NOTHING
      `);
      return;
    }
    await db.execute(sql`
      INSERT INTO signup_sources (user_id, source)
      SELECT u.id, 'direct' FROM users u
      WHERE u.id = ${userId}::uuid
        AND u.role = 'patient'
        AND u.created_at > now() - interval '14 days'
      ON CONFLICT (user_id) DO NOTHING
    `);
  } catch (e) {
    console.error("[signupSource] record failed", e);
  }
}
