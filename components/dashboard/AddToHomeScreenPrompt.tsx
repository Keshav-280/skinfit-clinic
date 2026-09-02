"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "skinfit-a2hs-dismissed";

type Kind = "ios-safari" | "ios-other-browser" | "android" | null;

function detectKind(): Kind {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isSafari ? "ios-safari" : "ios-other-browser";
  }
  if (isAndroid) return "android";
  return null;
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

/**
 * Nudges mobile patients browsing in a regular tab to install the app to
 * their home screen — that's the only way to get the full-screen,
 * no-browser-chrome experience (see app/manifest.ts). Shows every fresh
 * session until installed; dismissing only hides it for that session.
 */
export function AddToHomeScreenPrompt() {
  const [kind, setKind] = useState<Kind>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setKind(detectKind());
    setDismissed(false);
  }, []);

  if (!kind || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  const copy =
    kind === "ios-safari"
      ? {
          title: "Get the full-screen app",
          body: "Tap the Share icon below, then \"Add to Home Screen\" — no browser bars, just your skin dashboard.",
          icon: <Share className="h-4 w-4 shrink-0" aria-hidden />,
        }
      : kind === "ios-other-browser"
        ? {
            title: "Get the full-screen app",
            body: "Open this page in Safari, then use Share → \"Add to Home Screen\" for the full-screen experience.",
            icon: <Share className="h-4 w-4 shrink-0" aria-hidden />,
          }
        : {
            title: "Get the full-screen app",
            body: "Tap your browser's menu and choose \"Add to Home screen\" or \"Install app\" for the full-screen experience.",
            icon: <Share className="h-4 w-4 shrink-0" aria-hidden />,
          };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#DCCFC0] bg-[#F8EDEE] px-4 py-3 text-[#1E1B31]">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#1E1B31]">
        {copy.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{copy.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[#5B66A1]">
          {copy.body}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#5B66A1] transition hover:bg-white/60"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
