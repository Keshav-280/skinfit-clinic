"use client";

import { useEffect } from "react";

const COOKIE = "skinfit_src";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function clean(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return t || null;
}

/**
 * Remembers the first tracking link a visitor arrives on (?src=… or ?utm_source=…) for 30 days.
 * First touch wins: an existing cookie is never overwritten. The server reads it after signup.
 */
export function SourceCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`))) return;
      const params = new URLSearchParams(window.location.search);
      const source = clean(params.get("src") ?? params.get("utm_source"));
      if (!source) return;
      const campaign = clean(params.get("campaign") ?? params.get("utm_campaign"));
      const value = encodeURIComponent(JSON.stringify({ s: source, c: campaign }));
      document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch {
      /* cookies blocked: attribution simply falls back to "direct" */
    }
  }, []);
  return null;
}
