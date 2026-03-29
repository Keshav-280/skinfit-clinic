import React from "react";
import Link from "next/link";
import { Sparkles, User } from "lucide-react";
import { DashboardNav } from "./dashboard-nav";
import { LogoutButton } from "./logout-button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FDF9F0]">
      {/* Premium Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              SkinFit
            </span>
          </Link>

          <DashboardNav />

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-teal-50 text-teal-600 transition-colors hover:bg-teal-100"
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6 pb-12 sm:max-w-xl md:max-w-3xl">
        {children}
      </main>
    </div>
  );
}
