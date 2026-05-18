"use client";

import { useEffect, useState } from "react";
import { LastTreatmentCard, type LastTreatmentVisit } from "./LastTreatmentCard";

async function fetchLatestVisit(): Promise<LastTreatmentVisit | null> {
  const [profileRes, historyRes] = await Promise.all([
    fetch("/api/patient/skin-profile", { credentials: "include" }),
    fetch("/api/patient/history", { credentials: "include" }),
  ]);

  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      visits?: LastTreatmentVisit[];
    };
    if (profile.visits?.[0]) {
      return profile.visits[0];
    }
  }

  if (historyRes.ok) {
    const history = (await historyRes.json()) as {
      visitNotes?: Array<{
        id: string;
        visitDateYmd: string;
        doctorName: string;
      }>;
    };
    const first = history.visitNotes?.[0];
    if (first) {
      return {
        id: first.id,
        visitDate: first.visitDateYmd,
        doctorName: first.doctorName,
      };
    }
  }

  return null;
}

export function ProfileLastTreatmentSection() {
  const [visit, setVisit] = useState<LastTreatmentVisit | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await fetchLatestVisit();
        if (!cancelled) setVisit(latest);
      } catch {
        if (!cancelled) setVisit(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (visit === undefined) {
    return (
      <div
        className="h-[88px] animate-pulse rounded-2xl"
        style={{ backgroundColor: "#e0e5df" }}
        aria-hidden
      />
    );
  }

  if (!visit) return null;

  return <LastTreatmentCard visit={visit} />;
}
