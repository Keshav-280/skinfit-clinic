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
  return (
    `Cannot reach the server at ${base}. ` +
    "On a physical iPhone, use your Mac's Wi‑Fi IP (not localhost). " +
    "Run `npm run dev` in the repo root, then `npx expo start -c` in mobile/. " +
    `Open ${base} in Safari on the phone to verify.`
  );
}
