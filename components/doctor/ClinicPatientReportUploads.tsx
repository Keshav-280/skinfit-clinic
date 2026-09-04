"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  clinicDeviceReportLabel,
  type ClinicDeviceReportKind,
  type PatientDeviceReportRow,
} from "@/src/lib/clinicDeviceReportKind";

const KINDS: ClinicDeviceReportKind[] = ["medixora", "inbody"];

export function ClinicPatientReportUploads({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<PatientDeviceReportRow[]>([]);
  const [busyKind, setBusyKind] = useState<ClinicDeviceReportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const medixoraRef = useRef<HTMLInputElement>(null);
  const inbodyRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/doctor/patients/${patientId}/clinic-reports`,
      { credentials: "include", cache: "no-store" }
    );
    const data = (await res.json()) as {
      ok?: boolean;
      items?: PatientDeviceReportRow[];
    };
    if (res.ok && data.ok) setItems(data.items ?? []);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(kind: ClinicDeviceReportKind, file: File) {
    setError(null);
    setBusyKind(kind);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch(
        `/api/doctor/patients/${patientId}/clinic-reports`,
        { method: "POST", credentials: "include", body }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "FILE_TYPE") {
          setError("Use a PDF or image (JPG, PNG).");
        } else if (data.error === "FILE_TOO_LARGE") {
          setError("File must be 20 MB or smaller.");
        } else {
          setError("Could not upload report.");
        }
        return;
      }
      await load();
    } catch {
      setError("Could not upload report.");
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
        Clinic reports
      </h2>
      <p className="mt-1 text-[12px] text-[#1E1B31]/50">
        Upload a Medixora or InBody report. It appears in this patient’s scan
        history.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {KINDS.map((kind) => (
          <div key={kind}>
            <input
              ref={kind === "medixora" ? medixoraRef : inbodyRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(kind, file);
              }}
            />
            <button
              type="button"
              disabled={busyKind !== null}
              onClick={() =>
                (kind === "medixora" ? medixoraRef : inbodyRef).current?.click()
              }
              className="flex w-full flex-col items-start rounded-xl border border-dashed border-[#1E1B31]/20 bg-[#FAF8F5] px-3 py-3 text-left text-sm hover:bg-[#F0EAE2] disabled:opacity-50"
            >
              <span className="font-semibold text-[#1E1B31]">
                {clinicDeviceReportLabel(kind)}
              </span>
              <span className="mt-0.5 text-[11px] text-[#1E1B31]/50">
                {busyKind === kind ? "Uploading…" : "PDF or photo"}
              </span>
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-xs font-medium text-rose-700">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 text-[12px] text-[#1E1B31]/45">
          No clinic reports uploaded yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F5] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1E1B31]">
                  {clinicDeviceReportLabel(item.reportKind)}
                </p>
                <p className="text-[11px] text-[#1E1B31]/50">
                  {format(parseISO(item.createdAt), "d MMM yyyy")}
                </p>
              </div>
              <a
                href={item.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-[#1E1B31] underline"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
