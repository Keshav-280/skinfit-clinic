"use client";

import { usePathname } from "next/navigation";

export function ClinicPortalMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const opsWide =
    pathname === "/clinic/ops" || pathname.startsWith("/clinic/ops/");

  return (
    <main
      className={`mx-auto w-full flex-1 px-4 pb-10 pt-6 sm:px-6 ${
        opsWide ? "max-w-6xl" : "max-w-3xl"
      }`}
    >
      {children}
    </main>
  );
}
