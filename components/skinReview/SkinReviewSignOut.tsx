"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SkinReviewSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Sign out"
      onClick={async () => {
        await fetch("/api/skin-review/login", { method: "DELETE" });
        router.push("/skin-review");
        router.refresh();
      }}
      className="rounded-lg p-2 text-[#AEB9E8] hover:bg-[#2B2F63] hover:text-white"
    >
      <LogOut className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
