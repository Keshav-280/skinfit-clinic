"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import { dispatchGlobalLiveRefresh } from "@/src/lib/globalRefreshEvents";

export function GlobalRefreshButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(() => {
    setBusy(true);
    dispatchGlobalLiveRefresh();
    window.setTimeout(() => setBusy(false), 700);
  }, []);

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      className={clsx(
        compact
          ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#1E1B31]/70 backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-[#1E1B31] sm:h-9 sm:w-9"
          : "inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/50 px-3 py-2 text-sm font-medium text-[#1E1B31]/70 backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-[#1E1B31]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      title="Refresh now"
      aria-label="Refresh now"
    >
      <RefreshCw className={clsx("h-4 w-4", busy && "animate-spin")} aria-hidden />
      {compact ? null : "Refresh"}
    </button>
  );
}
