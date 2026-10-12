"use client";

import { usePathname } from "next/navigation";

export function ClinicPortalMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const opsWide =
    pathname === "/clinic/ops" || pathname.startsWith("/clinic/ops/");
  const patientDetail =
    pathname.startsWith("/clinic/patients/") && pathname !== "/clinic/patients/";
  const width = opsWide || patientDetail ? "max-w-6xl" : "max-w-4xl";

  return (
    <main
      className={`mx-auto w-full flex-1 px-4 pb-12 pt-7 sm:px-6 ${width}`}
    >
      {children}
    </main>
  );
}
