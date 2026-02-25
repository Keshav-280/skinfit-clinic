"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  Droplets,
  Wind,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { DashboardJournal } from "./DashboardJournal";

const ICON_MAP = {
  Target,
  Droplets,
  Wind,
  Sparkles,
} as const;

interface ParamConfig {
  label: string;
  value: number | string;
  icon: keyof typeof ICON_MAP;
  color: string;
}

interface DashboardViewProps {
  latestScan: { skinScore: number; createdAt: Date; analysisResults?: unknown } | null;
  todayLog: { journalEntry?: string | null } | null;
  nextAppointment: { dateTime: Date; type: string; status: string } | null;
  params: ParamConfig[];
  aiSummary: string;
  amItems: string[];
  pmItems: string[];
  amChecked: boolean;
  pmChecked: boolean;
}

const SVG_SIZE = 160;
const STROKE_WIDTH = 10;
const RADIUS = (SVG_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const RING_SIZE = 120;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const healthOverviewCards = [
  { title: "Routine Consistency", value: 85, color: "text-teal-400", strokeColor: "rgb(45, 212, 191)", label: "AM/PM Schedule" },
  { title: "Hydration Level", value: 92, color: "text-sky-400", strokeColor: "rgb(56, 189, 248)", label: "Skin Moisture" },
];

function HealthOverviewCard({ title, value, color, strokeColor, label, delay = 0 }: (typeof healthOverviewCards)[0] & { delay?: number }) {
  const strokeOffset = RING_CIRCUMFERENCE * (1 - value / 100);
  const shadowColor = strokeColor.replace("rgb(", "rgba(").replace(")", ", 0.5)");
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
    >
      <p className="mb-2 text-sm font-semibold text-zinc-400">{title}</p>
      <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          className="absolute"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgb(39 39 42)"
            strokeWidth={RING_STROKE}
          />
          <motion.circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${shadowColor})` }}
          />
        </svg>
        <span className={`relative z-10 text-2xl font-bold ${color}`}>{value}%</span>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">{label}</p>
    </motion.div>
  );
}

export function DashboardView({
  latestScan,
  todayLog,
  nextAppointment,
  params,
  aiSummary,
  amItems,
  pmItems,
  amChecked,
  pmChecked,
}: DashboardViewProps) {
  const scoreProgress = latestScan ? latestScan.skinScore / 100 : 0;
  const strokeOffset = CIRCUMFERENCE * (1 - scoreProgress);

  return (
    <div className="space-y-6">
      {/* Top Row: Routine | Skin Score | Hydration */}
      <section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Left: Routine Consistency */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }}
          >
            <HealthOverviewCard {...healthOverviewCards[0]} delay={0} />
          </motion.div>

          {/* Center: Your Skin Score */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Your Skin Score
            </h2>
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg
                width={SVG_SIZE}
                height={SVG_SIZE}
                className="absolute"
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={SVG_SIZE / 2}
                  cy={SVG_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="rgb(39 39 42)"
                  strokeWidth={STROKE_WIDTH}
                />
                {latestScan && (
                  <motion.circle
                    cx={SVG_SIZE / 2}
                    cy={SVG_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke="rgb(45 212 191)"
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    initial={{ strokeDashoffset: CIRCUMFERENCE }}
                    animate={{ strokeDashoffset: strokeOffset }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      filter: "drop-shadow(0 0 8px rgba(45, 212, 191, 0.5))",
                    }}
                  />
                )}
              </svg>
              <div className="relative z-10 flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl font-bold text-teal-400">
                    {latestScan?.skinScore ?? "--"}
                  </span>
                  <span className="block text-sm text-zinc-500">/100</span>
                </div>
              </div>
            </div>
            {latestScan?.createdAt && (
              <p className="mt-3 text-xs text-zinc-500">
                Last scan: {new Date(latestScan.createdAt).toLocaleDateString()}
              </p>
            )}
          </motion.section>

          {/* Right: Hydration Level */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HealthOverviewCard {...healthOverviewCards[1]} delay={0} />
          </motion.div>
        </div>
      </section>

      {/* Recommendation Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="rounded-2xl border border-zinc-800 bg-zinc-800/50 px-6 py-4"
      >
        <p className="text-center text-sm leading-relaxed text-zinc-300">
          {aiSummary}
        </p>
      </motion.div>

      {/* Middle Section - Skin Parameters (staggered 2nd) */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h3 className="mb-3 text-lg font-bold text-white">Skin Parameters</h3>
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50">
          {params.map((param) => {
            const Icon = ICON_MAP[param.icon];
            return (
              <motion.div
                key={param.label}
                whileHover={{ scale: 1.01, backgroundColor: "rgba(63, 63, 70, 0.4)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Link
                  href="/dashboard/history"
                  className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                      <Icon className={`h-5 w-5 ${param.color}`} />
                    </div>
                    <div>
                      <span className="font-medium text-white">{param.label}</span>
                      <span className="ml-2 text-teal-400">
                        {typeof param.value === "number" ? `${param.value}/100` : param.value}
                      </span>
                    </div>
                  </div>
                  <motion.span
                    className="inline-block text-zinc-500"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </motion.span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Bottom Section - Split Grid (staggered 3rd & 4th) */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Card - AM/PM Schedule */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h3 className="mb-4 text-lg font-bold text-white">AM/PM Schedule</h3>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                AM Routine
              </h4>
              <ul className="space-y-2">
                {amItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <motion.div
                      whileTap={{ scale: 0.95 }}
                      className={`flex h-5 w-5 shrink-0 cursor-default items-center justify-center rounded-full border-2 ${
                        amChecked ? "border-teal-400 bg-teal-400" : "border-zinc-600"
                      }`}
                    >
                      {amChecked && (
                        <svg className="h-2.5 w-2.5 text-zinc-900" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.div>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                PM Routine
              </h4>
              <ul className="space-y-2">
                {pmItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <motion.div
                      whileTap={{ scale: 0.95 }}
                      className={`flex h-5 w-5 shrink-0 cursor-default items-center justify-center rounded-full border-2 ${
                        pmChecked ? "border-teal-400 bg-teal-400" : "border-zinc-600"
                      }`}
                    >
                      {pmChecked && (
                        <svg className="h-2.5 w-2.5 text-zinc-900" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.div>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Right Card - Daily Journal (staggered 4th) */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h3 className="mb-4 text-lg font-bold text-white">Daily Journal</h3>
          <DashboardJournal initialEntry={todayLog?.journalEntry ?? undefined} />
        </motion.section>
      </div>

      {/* Upcoming Appointment */}
      {nextAppointment?.dateTime && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-center">
                <span className="block text-xs font-medium text-zinc-400">
                  {new Date(nextAppointment.dateTime).toLocaleString("default", {
                    month: "short",
                  })}
                </span>
                <span className="block text-xl font-bold text-teal-400">
                  {new Date(nextAppointment.dateTime).getDate()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-white">{nextAppointment.type}</p>
                <p className="text-sm text-zinc-400">
                  {nextAppointment.status} •{" "}
                  {new Date(nextAppointment.dateTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/schedules"
              className="rounded-full border border-teal-400/50 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-400 transition-colors hover:bg-teal-400/20"
            >
              View Details
            </Link>
          </div>
        </motion.section>
      )}
    </div>
  );
}
