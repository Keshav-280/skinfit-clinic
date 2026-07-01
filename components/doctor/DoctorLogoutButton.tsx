"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { LogOut } from "lucide-react";

export function DoctorLogoutButton({
  collapsed = false,
  compact = false,
}: {
  collapsed?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/doctor/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy}
      title={collapsed || compact ? "Log out" : undefined}
      aria-label={collapsed || compact ? "Log out" : undefined}
      className={`flex items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 ${
        compact
          ? "h-9 w-9 shrink-0 justify-center p-0"
          : collapsed
            ? "w-full justify-center p-2.5"
            : "gap-2 px-3 py-2 text-sm font-medium"
      }`}
    >
      <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {collapsed || compact ? (
        <span className="sr-only">{busy ? "Logging out" : "Log out"}</span>
      ) : (
        <span>{busy ? "…" : "Log out"}</span>
      )}
    </button>
  );
}
