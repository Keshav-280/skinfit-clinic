"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, FileText, QrCode, Trash2 } from "lucide-react";
import { CLINIC } from "@/components/doctor/clinicUi";
import { MedixoraReportView } from "@/components/medixora/MedixoraReportView";
import { QrScanner } from "@/components/medixora/QrScanner";
import type { MedixoraReport } from "@/src/lib/medixora/report";

type Patient = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
};
type Saved = { id: string; title: string; addedAt: string; scanDate: string | null; overallScore: number | null; url: string };
type Preview = {
  link: string;
  report: MedixoraReport;
  match: "match" | "different" | "unknown";
  saved: { samePatient: boolean; patientName: string } | null;
};

const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E1B31] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#242A5F] disabled:opacity-60";

export function MedixoraPatient({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reports, setReports] = useState<Saved[]>([]);
  const [scanning, setScanning] = useState(false);
  const [link, setLink] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<"" | "reading" | "saving">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/medixora/patients/${patientId}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { patient?: Patient; reports?: Saved[]; message?: string };
    if (!res.ok || !data.patient) throw new Error(data.message || "Could not load this patient.");
    setPatient(data.patient);
    setReports(data.reports ?? []);
  }, [patientId]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  async function post<T>(url: string, body: object): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  }

  async function read(scanned: string) {
    setScanning(false);
    setError("");
    setNotice("");
    setPreview(null);
    setChecked(false);
    setBusy("reading");
    try {
      const data = await post<Omit<Preview, "link">>("/api/medixora/preview", { patientId, link: scanned });
      setPreview({ ...data, link: scanned });
      setLink("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the report.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!preview) return;
    setError("");
    setBusy("saving");
    try {
      const data = await post<{ alreadySaved: boolean; withoutText?: boolean }>("/api/medixora/save", { patientId, link: preview.link });
      setPreview(null);
      setNotice(
        data.alreadySaved
          ? "This report was already saved for this patient."
          : data.withoutText
            ? "Saved without the written comments, because they could not be checked. To try again, remove this report and scan once more."
            : "Saved. The PDF is now in the patient's history."
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the report.");
    } finally {
      setBusy("");
    }
  }

  async function remove(report: Saved) {
    if (!window.confirm(`Remove "${report.title}" from ${patient?.name}? The patient will no longer see it. This cannot be undone.`)) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/medixora/patients/${patientId}/reports/${report.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not remove the report.");
      return;
    }
    setNotice("Report removed.");
    await load().catch((e: Error) => setError(e.message));
  }

  const needsCheck = preview != null && preview.match !== "match";
  const blocked = preview?.saved && !preview.saved.samePatient;

  return (
    <div className="space-y-5">
      <Link href="/medixora-reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All patients
      </Link>

      {patient ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1E1B31] p-5 text-white">
          <div>
            <h1 className="font-headline text-2xl font-semibold">{patient.name}</h1>
            <p className="text-sm text-[#AEB9E8]">
              {[patient.phone, patient.email, patient.age != null ? `${patient.age} yrs` : null, patient.gender]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => {
              setScanning(true);
              setPreview(null);
              setError("");
              setNotice("");
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#1E1B31] disabled:opacity-60"
          >
            <QrCode className="h-4 w-4" aria-hidden />
            Scan Medixora QR
          </button>
        </section>
      ) : !error ? (
        <p className={CLINIC.muted}>Loading…</p>
      ) : null}

      {error ? <p role="alert" className={CLINIC.noteError}>{error}</p> : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">{notice}</p>
      ) : null}

      {scanning ? <QrScanner onResult={(t) => void read(t)} onClose={() => setScanning(false)} /> : null}

      {patient && !preview ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim() && !busy) void read(link.trim());
          }}
        >
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Or paste the Medixora report link"
            aria-label="Medixora report link"
            className={`${CLINIC.input} min-w-0 flex-1`}
          />
          <button type="submit" disabled={!link.trim() || busy !== ""} className={BUTTON}>
            Open
          </button>
        </form>
      ) : null}

      {busy === "reading" ? <p className={CLINIC.muted}>Reading the report…</p> : null}

      {preview && patient ? (
        <div className="space-y-3">
          {blocked ? (
            <p className={CLINIC.noteError}>
              This report is already saved for {preview.saved!.patientName}. Remove it there first if that was a mistake.
            </p>
          ) : preview.saved ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Already saved for this patient.</p>
          ) : (
            <div className="rounded-2xl border border-[#E4E6F0] bg-white p-4">
              {needsCheck ? (
                <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    {preview.match === "different" ? "The names do not match" : "The name could not be checked"}
                  </p>
                  <p className="mt-1">
                    Medixora: {preview.report.customer.name || "no name"}. Chosen patient: {patient.name}.
                  </p>
                  <label className="mt-2 flex items-center gap-2 font-semibold">
                    <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    I checked: this scan belongs to {patient.name}
                  </label>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void save()} disabled={busy !== "" || (needsCheck && !checked)} className={BUTTON}>
                  {busy === "saving" ? "Creating the report, up to a minute…" : `Save to ${patient.name}`}
                </button>
                <button type="button" onClick={() => setPreview(null)} disabled={busy !== ""} className="rounded-xl px-4 py-3 text-sm font-semibold text-[#5B66A1]">
                  Cancel
                </button>
              </div>
            </div>
          )}
          <MedixoraReportView patientName={patient.name} report={preview.report} />
        </div>
      ) : null}

      {patient ? (
        <section className={CLINIC.cardPad}>
          <h2 className={CLINIC.h2}>Past reports</h2>
          {reports.length === 0 ? (
            <p className={`mt-2 ${CLINIC.muted}`}>No Medixora report yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#E4E6F0]">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-[#5B66A1]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1E1B31]">{r.title}</p>
                    <p className="text-xs text-[#5B66A1]">
                      {r.overallScore != null ? `Overall ${r.overallScore} / 100 | ` : ""}
                      Added {new Date(r.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <a href={r.url} target="_blank" rel="noreferrer" className="rounded-lg border border-[#1E1B31]/20 px-3 py-2 text-sm font-semibold text-[#1E1B31]">
                    Open PDF
                  </a>
                  <button type="button" onClick={() => void remove(r)} aria-label={`Remove ${r.title}`} className="rounded-lg p-2 text-[#5B66A1] hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
