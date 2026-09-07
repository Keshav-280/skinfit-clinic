const OPS_PORTAL_DEFAULT = "/ops";

/** Safe post-login path for the ops portal. */
export function sanitizeOpsPortalNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return OPS_PORTAL_DEFAULT;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return OPS_PORTAL_DEFAULT;
  }
  if (trimmed === "/ops/login") return OPS_PORTAL_DEFAULT;
  if (trimmed === "/ops" || trimmed.startsWith("/ops/")) return trimmed;
  return OPS_PORTAL_DEFAULT;
}

export function opsPortalLoginUrl(origin: string, returnPath: string): URL {
  const login = new URL("/ops/login", origin);
  login.searchParams.set("next", sanitizeOpsPortalNext(returnPath));
  return login;
}
