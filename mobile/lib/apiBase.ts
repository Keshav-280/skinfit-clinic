export function getApiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "Set EXPO_PUBLIC_API_URL (e.g. http://192.168.0.110:3000) in mobile/.env"
    );
  }
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Shown when fetch() fails before any HTTP response (device cannot open TCP to API). */
export function networkFetchErrorMessage(): string {
  const base =
    process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ||
    "(EXPO_PUBLIC_API_URL not set in mobile/.env)";
  const isLocal =
    /localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./i.test(base);
  const hints = isLocal
    ? "Use your Mac's Wi‑Fi IP in mobile/.env (not localhost), run `npm run dev` in the repo root, then reload the app."
    : "Open the same URL in Safari on the phone. If Safari fails, check EC2 security group (port 80) and nginx. If Safari works but the app does not, rebuild iOS after changing EXPO_PUBLIC_API_URL (`npx expo run:ios --device`). For http:// APIs, iOS needs ATS exceptions (see mobile/app.config.js). Prefer https:// when you have a domain.";
  return `Cannot reach the server at ${base}. ${hints}`;
}
