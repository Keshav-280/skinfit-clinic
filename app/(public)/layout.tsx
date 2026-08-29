import type { ReactNode } from "react";
import { PublicNavbar } from "../../components/nav/PublicNavbar";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E1B31]">
      <PublicNavbar />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}

