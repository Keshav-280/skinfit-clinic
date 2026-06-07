"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, HeartPulse, Plus, Send, Trash2, X } from "lucide-react";
import {
  doctorBtnPrimaryClass,
  doctorBtnPrimarySmClass,
  doctorEmptyStateClass,
  doctorFormInputClass,
  doctorNavyIconChipClass,
  doctorPatientPageCardClass,
  doctorPatientPageFormInputClass,
  doctorPatientPagePanelClass,
} from "@/components/doctor/DoctorUiPrimitives";
import { useDoctorCustomTreatments } from "@/components/doctor/useDoctorCustomTreatments";
import {
  formatClinicTreatmentCareMessage,
  HYDRAFACIAL_TREATMENT,
  listBuiltInClinicTreatments,
  type ClinicTreatmentPhase,
} from "@/src/lib/clinicTreatmentGuides";
import { DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT } from "@/src/lib/doctorPatientChatInboxEvents";

type DoctorClinicTreatmentsPanelProps = {
  patientId: string;
};

function CareList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[11px] text-[#2C3E6B]/45">
        No {title.toLowerCase()} items yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={`${title}-${item}`}
          className="flex gap-2 text-[11px] leading-snug text-[#2C3E6B]/85"
        >
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#2C3E6B]/35" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function DoctorClinicTreatmentsPanel({ patientId }: DoctorClinicTreatmentsPanelProps) {
  const builtIn = useMemo(() => listBuiltInClinicTreatments(), []);
  const { items: customTreatments, add, remove } = useDoctorCustomTreatments();

  const allTreatments = useMemo(
    () => [...builtIn, ...customTreatments],
    [builtIn, customTreatments]
  );

  const [selectedId, setSelectedId] = useState(HYDRAFACIAL_TREATMENT.id);
  const [previewPhase, setPreviewPhase] = useState<ClinicTreatmentPhase>("pre");
  const [sendBusy, setSendBusy] = useState<ClinicTreatmentPhase | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPre, setDraftPre] = useState("");
  const [draftDos, setDraftDos] = useState("");
  const [draftDonts, setDraftDonts] = useState("");

  const selected =
    allTreatments.find((t) => t.id === selectedId) ?? HYDRAFACIAL_TREATMENT;

  async function sendCare(phase: ClinicTreatmentPhase) {
    setFlash(null);
    setSendBusy(phase);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/treatment-care`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentId: selected.id,
          phase,
          treatment: selected.isBuiltIn ? undefined : selected,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setFlash(json.error ?? "Could not send care instructions.");
        return;
      }
      setFlash(
        phase === "pre"
          ? `Pre-care sent for ${selected.name}.`
          : `Post-care sent for ${selected.name}.`
      );
      window.dispatchEvent(new Event(DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT));
    } catch {
      setFlash("Network error.");
    } finally {
      setSendBusy(null);
    }
  }

  function submitCustomTreatment() {
    const name = draftName.trim();
    if (!name) return;
    add({
      name,
      preCare: parseLines(draftPre),
      postCareDos: parseLines(draftDos),
      postCareDonts: parseLines(draftDonts),
    });
    setDraftName("");
    setDraftPre("");
    setDraftDos("");
    setDraftDonts("");
    setAddOpen(false);
    setFlash("Custom treatment saved.");
  }

  const previewText = formatClinicTreatmentCareMessage(selected, previewPhase);

  return (
    <div className={`${doctorPatientPageCardClass} mt-4 p-4`}>
      <h2 className="mb-4 flex items-center gap-2 border-b border-[#2C3E6B]/15 pb-3 text-[#2C3E6B]">
        <span className={`h-8 w-8 rounded-lg ${doctorNavyIconChipClass}`}>
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Clinic treatments</span>
      </h2>

      <p className="mb-3 text-[11px] leading-snug text-[#2C3E6B]/55">
        Send offline in-clinic treatment pre- and post-care guides to the patient chat.
      </p>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#2C3E6B]">
              Treatment
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className={`${doctorPatientPageFormInputClass} py-1.5`}
            >
              {allTreatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isBuiltIn ? "" : " (custom)"}
                </option>
              ))}
            </select>
          </div>

          {!selected.isBuiltIn ? (
            <button
              type="button"
              onClick={() => remove(selected.id)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
              Remove custom treatment
            </button>
          ) : null}

          <div className="flex gap-1">
            {(["pre", "post"] as const).map((phase) => (
              <button
                key={phase}
                type="button"
                onClick={() => setPreviewPhase(phase)}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                  previewPhase === phase
                    ? "bg-[#2C3E6B] text-white"
                    : "bg-[#F1F4FA] text-[#2C3E6B]/70 hover:bg-[#E8EDF6]"
                }`}
              >
                {phase === "pre" ? "Pre-care" : "Post-care"}
              </button>
            ))}
          </div>

          <div className={`${doctorPatientPagePanelClass} p-3`}>
            {previewPhase === "pre" ? (
              <CareList title="Pre-care" items={selected.preCare} />
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]/50">
                    Do
                  </p>
                  <CareList title="Do" items={selected.postCareDos} />
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]/50">
                    Avoid
                  </p>
                  <CareList title="Avoid" items={selected.postCareDonts} />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sendBusy !== null}
              onClick={() => void sendCare("pre")}
              className={`${doctorBtnPrimarySmClass} inline-flex items-center gap-1`}
            >
              <Send className="h-3 w-3" aria-hidden />
              {sendBusy === "pre" ? "Sending…" : "Send pre-care to chat"}
            </button>
            <button
              type="button"
              disabled={sendBusy !== null}
              onClick={() => void sendCare("post")}
              className={`${doctorBtnPrimarySmClass} inline-flex items-center gap-1`}
            >
              <Send className="h-3 w-3" aria-hidden />
              {sendBusy === "post" ? "Sending…" : "Send post-care to chat"}
            </button>
          </div>

          {flash ? (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-[#2C3E6B]" role="status">
              <Check className="h-3.5 w-3.5" aria-hidden />
              <span>{flash}</span>
            </p>
          ) : null}
        </div>

        <div className={`${doctorPatientPagePanelClass} flex min-h-[12rem] flex-col p-3`}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#2C3E6B]/50">
            Chat preview
          </p>
          <pre className="flex-1 whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-[#2C3E6B]/85">
            {previewText}
          </pre>
        </div>
      </div>

      <div className="mt-4 border-t border-[#2C3E6B]/10 pt-3">
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs font-semibold text-[#2C3E6B] hover:bg-[#F8F9FC]"
          aria-expanded={addOpen}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add custom treatment
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#2C3E6B]/45 transition ${addOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {addOpen ? (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Treatment name"
              className={`${doctorPatientPageFormInputClass} py-1.5`}
            />
            <textarea
              value={draftPre}
              onChange={(e) => setDraftPre(e.target.value)}
              rows={3}
              placeholder={"Pre-care (one item per line)\nStop retinol 2–3 days before…"}
              className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
            />
            <textarea
              value={draftDos}
              onChange={(e) => setDraftDos(e.target.value)}
              rows={3}
              placeholder={"Post-care DO's (one per line)\nUse SPF 30+…"}
              className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
            />
            <textarea
              value={draftDonts}
              onChange={(e) => setDraftDonts(e.target.value)}
              rows={3}
              placeholder={"Post-care DON'Ts (one per line)\nAvoid hot showers…"}
              className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!draftName.trim()}
                onClick={submitCustomTreatment}
                className={`${doctorBtnPrimaryClass} inline-flex items-center gap-1 px-3 py-1.5 text-xs`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Save treatment
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2C3E6B]/15 px-3 py-1.5 text-xs font-semibold text-[#2C3E6B]/70 hover:bg-[#F8F9FC]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </button>
            </div>
          </div>
        ) : customTreatments.length === 0 ? (
          <p className={`${doctorEmptyStateClass} mt-2 px-2 py-3 text-[11px]`}>
            No custom treatments saved yet. Add clinic-specific guides here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
