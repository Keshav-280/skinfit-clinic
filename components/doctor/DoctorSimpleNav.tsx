"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Users } from "lucide-react";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";

function navClass(active: boolean) {
  return `relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active
      ? "bg-[#1E1B31] text-white"
      : "text-[#1E1B31]/70 hover:bg-[#1E1B31]/8 hover:text-[#1E1B31]"
  }`;
}

export function DoctorSimpleNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/doctor/schedule-requests", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { pendingCount?: number };
      if (res.ok) setPending(data.pendingCount ?? 0);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    const onRefresh = () => void load();
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  const requestsActive =
    pathname === "/clinic/requests" || pathname.startsWith("/clinic/requests/");
  const patientsActive =
    pathname === "/clinic/patients" || pathname.startsWith("/clinic/patients/");

  return (
    <nav className="flex items-center gap-1" aria-label="Clinic portal">
      <Link href="/clinic/requests" className={navClass(requestsActive)}>
        <CalendarClock className="h-4 w-4" aria-hidden />
        Requests
        {pending > 0 ? (
          <span className="ml-0.5 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[#DF9DA4] px-1 text-[10px] font-bold leading-none text-[#1E1B31]">
            {pending > 99 ? "99+" : pending}
          </span>
        ) : null}
      </Link>
      <Link href="/clinic/patients" className={navClass(patientsActive)}>
        <Users className="h-4 w-4" aria-hidden />
        Patients
      </Link>
    </nav>
  );
}
