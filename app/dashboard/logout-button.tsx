"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/50 text-[#2C3E6B]/70 backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-[#2C3E6B]"
      title="Logout"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
