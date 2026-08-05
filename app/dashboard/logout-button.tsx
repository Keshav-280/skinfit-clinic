"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

type Props = {
  /** Icon-only control for compact chrome; default is a full labeled button. */
  compact?: boolean;
  className?: string;
};

export function LogoutButton({ compact = false, className = "" }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void logout()}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#2C3E6B]/70 backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-[#2C3E6B] ${className}`}
        title="Log out"
      >
        <LogOut className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 sm:w-auto ${className}`}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      Log Out
    </button>
  );
}
