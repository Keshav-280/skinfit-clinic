export const LEGACY_ANNOTATOR_SCOPE = "default";

export function annotatorUserScope(userId: string): string {
  return `user:${userId}`;
}

export function parseAnnotatorUserScope(scope: string): string | null {
  if (!scope.startsWith("user:")) return null;
  const id = scope.slice(5).trim();
  return id || null;
}

/** Comma-separated user UUIDs for one-click rebalance in the annotator UI. */
export function annotatorTeamUserIdsFromEnv(): string[] {
  const raw = process.env.ANNOTATOR_TEAM_USER_IDS?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}
