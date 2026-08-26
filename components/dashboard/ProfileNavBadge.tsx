"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import {
  AvatarIcon,
  initialsFromName,
  resolveGender,
} from "@/components/dashboard/SkinDNACard";

type ProfileNavData = {
  photoUrl: string | null;
  pct: number | null;
  name: string;
  gender: string | null;
};

const SIZE = 36;
const STROKE = 2.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Top-nav profile entry: patient's avatar ringed with an animated arc
 * showing how much of their profile is complete.
 */
export function ProfileNavBadge() {
  const [data, setData] = useState<ProfileNavData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/home", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const total = j.progress?.milestones?.length ?? 0;
        const done = j.progress?.completedCount ?? 0;
        setData({
          photoUrl: j.profilePhotoUrl ?? null,
          pct: total > 0 ? Math.round((done / total) * 100) : null,
          name: j.userName ?? "",
          gender: j.gender ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pct = data?.pct ?? null;
  const offset =
    pct != null ? CIRCUMFERENCE * (1 - Math.min(100, pct) / 100) : CIRCUMFERENCE;

  return (
    <Link
      href="/dashboard/profile"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E6B]/40"
      title={pct != null ? `Profile ${pct}% complete` : "Profile"}
      aria-label={pct != null ? `Profile, ${pct}% complete` : "Profile"}
    >
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={STROKE}
        />
        {pct != null ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#2C3E6B"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        ) : null}
      </svg>
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2C3E6B]/10">
        {data?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : data ? (
          (() => {
            const resolvedGender = resolveGender(data.gender);
            return resolvedGender ? (
              <AvatarIcon gender={resolvedGender} />
            ) : (
              <span className="text-[10px] font-bold tracking-wide text-[#2C3E6B]">
                {initialsFromName(data.name || "Patient")}
              </span>
            );
          })()
        ) : (
          <User className="h-3.5 w-3.5 text-[#2C3E6B]" aria-hidden />
        )}
      </span>
    </Link>
  );
}
