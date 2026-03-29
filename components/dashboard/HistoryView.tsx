"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, Sparkles, User } from "lucide-react";
import { format } from "date-fns";
import { dateOnlyFromYmd } from "@/src/lib/date-only";

/** Demo lab rows until lab orders exist in the database. */
const PLACEHOLDER_LAB_REPORTS: {
  id: string;
  title: string;
  at: Date;
}[] = [
  { id: "lab-cbc", title: "Complete Blood Count", at: new Date("2025-10-01") },
  { id: "lab-hormonal", title: "Hormonal Panel", at: new Date("2025-09-18") },
];

const CARD =
  "rounded-[22px] border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] md:p-6";

export interface ScanRecord {
  id: number;
  scanName: string | null;
  imageUrl: string;
  overallScore: number;
  acne: number;
  pigmentation: number;
  wrinkles: number;
  hydration: number;
  texture: number;
  /** Same formula as `skin_scans` / dashboard (not a DB column on `scans`). */
  eczema: number;
  createdAt: Date | string;
  aiSummary: string | null;
}

export interface VisitNoteRecord {
  id: string;
  /** `YYYY-MM-DD` from `visit_notes.visit_date`. */
  visitDateYmd: string;
  doctorName: string;
  notes: string;
}

interface HistoryViewProps {
  scans: ScanRecord[];
  visitNotes: VisitNoteRecord[];
}

type ReportListItem =
  | {
      kind: "ai";
      key: string;
      scanId: number;
      title: string;
      dateLabel: string;
      sortTime: number;
    }
  | {
      kind: "lab";
      key: string;
      title: string;
      dateLabel: string;
      sortTime: number;
    };

function buildLabAndScanReports(scans: ScanRecord[]): ReportListItem[] {
  const fromScans: ReportListItem[] = scans.map((s) => {
    const d = new Date(s.createdAt);
    const name = s.scanName?.trim();
    return {
      kind: "ai",
      key: `scan-${s.id}`,
      scanId: s.id,
      title: name ? `AI skin scan – ${name}` : "AI skin scan",
      dateLabel: format(d, "MMM d, yyyy"),
      sortTime: d.getTime(),
    };
  });
  const fromLabs: ReportListItem[] = PLACEHOLDER_LAB_REPORTS.map((r) => ({
    kind: "lab",
    key: r.id,
    title: r.title,
    dateLabel: format(r.at, "MMM d, yyyy"),
    sortTime: r.at.getTime(),
  }));
  return [...fromScans, ...fromLabs].sort((a, b) => b.sortTime - a.sortTime);
}

export function HistoryView({ scans, visitNotes }: HistoryViewProps) {
  const labAndScanReports = useMemo(
    () => buildLabAndScanReports(scans),
    [scans]
  );

  return (
    <div className="space-y-6">
      {/* Patient Profile */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={CARD}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-zinc-200 bg-[#E0F0ED]/60">
              <User className="h-12 w-12 text-[#6B8E8E]" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">Test Patient</h2>
            <p className="text-sm text-zinc-600">Age: 28</p>
            <p className="text-sm text-zinc-600">
              Skin Type:{" "}
              <span className="font-semibold text-teal-700">Combination</span>
            </p>
            <p className="text-sm text-zinc-600">
              Primary Goal:{" "}
              <span className="font-semibold text-teal-700">Acne Reduction</span>
            </p>
          </div>
        </div>
      </motion.section>

      {/* Progress Tracker - Scans from DB */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className={CARD}
      >
        <h3 className="mb-4 text-lg font-bold text-zinc-900">Progress Tracker</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {scans.length > 0 ? (
            scans.map((scan) => (
              <motion.div
                key={scan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-[18px] border border-zinc-200 bg-white shadow-sm"
              >
                <div className="relative h-48 overflow-hidden rounded-t-[18px] bg-zinc-100">
                  <img
                    src={scan.imageUrl}
                    alt={scan.scanName || "Skin scan"}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-lg font-bold text-teal-700 shadow-sm">
                    {scan.overallScore}
                  </div>
                </div>
                <div className="border-t border-zinc-100 px-4 py-3">
                  <p className="font-medium text-zinc-900">
                    {scan.scanName || "Untitled Scan"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {format(new Date(scan.createdAt), "MMM d, yyyy")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-teal-700">
                    Overall {scan.overallScore}/100
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(
                      [
                        ["Acne", scan.acne],
                        ["Wrinkle", scan.wrinkles],
                        ["Pores", scan.texture],
                        ["Pigment.", scan.pigmentation],
                        ["Hydration", scan.hydration],
                        ["Eczema", scan.eczema],
                      ] as const
                    ).map(([label, val]) => (
                      <span
                        key={label}
                        className="rounded-md bg-[#E0F0ED]/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-teal-900"
                      >
                        {label} {val}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/dashboard/history/scans/${scan.id}`}
                    className="mt-3 flex w-full items-center justify-center rounded-xl bg-teal-600 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-500"
                  >
                    View details
                  </Link>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="col-span-full py-8 text-center text-sm text-zinc-600">
              No scans yet. Complete your first AI skin scan to track progress.
            </p>
          )}
        </div>
      </motion.section>

      {/* Visit History & Notes */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className={CARD}
      >
        <h3 className="mb-4 text-lg font-bold text-zinc-900">
          Visit History & Notes
        </h3>
        <div className="space-y-4">
          {visitNotes.length > 0 ? (
            visitNotes.map((visit) => (
              <div
                key={visit.id}
                className="rounded-[18px] border border-zinc-100 bg-[#FDF9F0]/80 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-teal-700">
                    {format(
                      dateOnlyFromYmd(visit.visitDateYmd),
                      "MMM d, yyyy"
                    )}
                  </span>
                  <span className="text-sm text-zinc-600">
                    {visit.doctorName}
                  </span>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Doctor&apos;s Notes
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-700">
                    {visit.notes}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-zinc-600">
              No visit notes yet.
            </p>
          )}
        </div>
      </motion.section>

      {/* Lab & Scan Reports */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className={CARD}
      >
        <h3 className="mb-4 text-lg font-bold text-zinc-900">
          Lab & Scan Reports
        </h3>
        <div className="space-y-3">
          {labAndScanReports.map((report) => (
            <div
              key={report.key}
              className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-zinc-200 bg-zinc-50/80 px-4 py-3 transition-colors hover:border-[#6B8E8E]/40 hover:bg-[#E0F0ED]/40"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E0F0ED]">
                  {report.kind === "ai" ? (
                    <Sparkles className="h-5 w-5 text-[#6B8E8E]" aria-hidden />
                  ) : (
                    <FileText className="h-5 w-5 text-[#6B8E8E]" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">
                    {report.title}
                  </p>
                  <p className="text-xs text-zinc-500">{report.dateLabel}</p>
                </div>
              </div>
              {report.kind === "ai" ? (
                <Link
                  href={`/dashboard/history/scans/${report.scanId}`}
                  className="shrink-0 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-500"
                >
                  View details
                </Link>
              ) : (
                <span className="shrink-0 text-xs font-medium text-zinc-400">
                  Sample
                </span>
              )}
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
