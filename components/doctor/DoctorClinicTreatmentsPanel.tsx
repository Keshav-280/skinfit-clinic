"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  HeartPulse,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";
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
import { useDoctorClinicTreatments } from "@/components/doctor/useDoctorClinicTreatments";
import {
  formatClinicTreatmentCareMessage,
  HYDRAFACIAL_TREATMENT,
  type ClinicTreatmentPhase,
} from "@/src/lib/clinicTreatmentGuides";
import {
  linesToText,
  parseTreatmentLines,
  treatmentToInput,
  type ClinicTreatmentInput,
} from "@/src/lib/doctorTreatmentCatalog";
import { DOCTOR_PATIENT_CHAT_INBOX_REFRESH_EVENT } from "@/src/lib/doctorPatientChatInboxEvents";

type DoctorClinicTreatmentsPanelProps = {
  patientId: string;
};

type FormMode = "add" | "edit" | null;

function CareList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[11px] text-[#1E1B31]/45">
        No {title.toLowerCase()} items yet.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={`${title}-${item}`}
          className="flex gap-2 text-[11px] leading-snug text-[#1E1B31]/85"
        >
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#1E1B31]/35" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TreatmentForm({
  draftName,
  draftPre,
  draftDos,
  draftDonts,
  onNameChange,
  onPreChange,
  onDosChange,
  onDontsChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  draftName: string;
  draftPre: string;
  draftDos: string;
  draftDonts: string;
  onNameChange: (v: string) => void;
  onPreChange: (v: string) => void;
  onDosChange: (v: string) => void;
  onDontsChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={draftName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Treatment name"
        className={`${doctorPatientPageFormInputClass} py-1.5`}
      />
      <textarea
        value={draftPre}
        onChange={(e) => onPreChange(e.target.value)}
        rows={3}
        placeholder={"Pre-care (one item per line)\nStop retinol 2-3 days before…"}
        className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
      />
      <textarea
        value={draftDos}
        onChange={(e) => onDosChange(e.target.value)}
        rows={3}
        placeholder={"Post-care DO's (one per line)\nUse SPF 30+…"}
        className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
      />
      <textarea
        value={draftDonts}
        onChange={(e) => onDontsChange(e.target.value)}
        rows={3}
        placeholder={"Post-care DON'Ts (one per line)\nAvoid hot showers…"}
        className={`${doctorFormInputClass} min-h-[4.5rem] resize-y text-xs`}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!draftName.trim()}
          onClick={onSubmit}
          className={`${doctorBtnPrimaryClass} inline-flex items-center gap-1 px-3 py-1.5 text-xs`}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-[#1E1B31]/15 px-3 py-1.5 text-xs font-semibold text-[#1E1B31]/70 hover:bg-[#F8F9FC]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </button>
      </div>
    </div>
  );
}

function inputFromDraft(
  draftName: string,
  draftPre: string,
  draftDos: string,
  draftDonts: string
): ClinicTreatmentInput {
  return {
    name: draftName.trim(),
    preCare: parseTreatmentLines(draftPre),
    postCareDos: parseTreatmentLines(draftDos),
    postCareDonts: parseTreatmentLines(draftDonts),
  };
}

export function DoctorClinicTreatmentsPanel({ patientId }: DoctorClinicTreatmentsPanelProps) {
  const { items: allTreatments, hiddenBuiltIn, add, update, remove, restore } =
    useDoctorClinicTreatments();

  const [selectedId, setSelectedId] = useState(HYDRAFACIAL_TREATMENT.id);
  const [previewPhase, setPreviewPhase] = useState<ClinicTreatmentPhase>("pre");
  const [sendBusy, setSendBusy] = useState<ClinicTreatmentPhase | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPre, setDraftPre] = useState("");
  const [draftDos, setDraftDos] = useState("");
  const [draftDonts, setDraftDonts] = useState("");

  const selected = useMemo(
    () => allTreatments.find((t) => t.id === selectedId) ?? allTreatments[0] ?? HYDRAFACIAL_TREATMENT,
    [allTreatments, selectedId]
  );

  useEffect(() => {
    if (!allTreatments.some((t) => t.id === selectedId) && allTreatments[0]) {
      setSelectedId(allTreatments[0].id);
    }
  }, [allTreatments, selectedId]);

  function resetForm() {
    setFormMode(null);
    setEditingId(null);
    setDraftName("");
    setDraftPre("");
    setDraftDos("");
    setDraftDonts("");
  }

  function loadTreatmentIntoForm(treatment: typeof selected) {
    const input = treatmentToInput(treatment);
    setDraftName(input.name);
    setDraftPre(linesToText(input.preCare));
    setDraftDos(linesToText(input.postCareDos));
    setDraftDonts(linesToText(input.postCareDonts));
  }

  function startEdit(treatment: typeof selected) {
    setFormMode("edit");
    setEditingId(treatment.id);
    loadTreatmentIntoForm(treatment);
    setManageOpen(true);
    setSelectedId(treatment.id);
  }

  function startAdd() {
    resetForm();
    setFormMode("add");
    setManageOpen(true);
  }

  async function sendCare(phase: ClinicTreatmentPhase) {
    if (!selected) return;
    setFlash(null);
    setSendBusy(phase);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/treatment-care`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentId: selected.id,
          phase,
          treatment: {
            id: selected.id,
            name: selected.name,
            preCare: selected.preCare,
            postCareDos: selected.postCareDos,
            postCareDonts: selected.postCareDonts,
          },
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

  function submitForm() {
    const input = inputFromDraft(draftName, draftPre, draftDos, draftDonts);
    if (!input.name) return;

    if (formMode === "add") {
      add(input);
      setFlash("Treatment added.");
      resetForm();
      return;
    }

    if (formMode === "edit" && editingId && selected) {
      const target = allTreatments.find((t) => t.id === editingId) ?? selected;
      update(editingId, input, Boolean(target.isBuiltIn));
      setSelectedId(editingId);
      setFlash(`${input.name} updated.`);
      resetForm();
    }
  }

  function handleDelete(treatment: typeof selected) {
    const label = treatment.isBuiltIn ? "hide" : "delete";
    const ok = window.confirm(
      treatment.isBuiltIn
        ? `Hide ${treatment.name} from your treatment list? You can restore it later.`
        : `Delete ${treatment.name}? This cannot be undone.`
    );
    if (!ok) return;
    remove(treatment.id, Boolean(treatment.isBuiltIn));
    if (selectedId === treatment.id && allTreatments.length > 1) {
      const next = allTreatments.find((t) => t.id !== treatment.id);
      if (next) setSelectedId(next.id);
    }
    setFlash(
      treatment.isBuiltIn
        ? `${treatment.name} hidden from list.`
        : `${treatment.name} deleted.`
    );
    if (editingId === treatment.id) resetForm();
  }

  const previewText = selected
    ? formatClinicTreatmentCareMessage(selected, previewPhase)
    : "";

  return (
    <div className={`${doctorPatientPageCardClass} mt-4 p-4`}>
      <h2 className="mb-4 flex items-center gap-2 border-b border-[#1E1B31]/15 pb-3 text-[#1E1B31]">
        <span className={`h-8 w-8 rounded-lg ${doctorNavyIconChipClass}`}>
          <HeartPulse className="h-4 w-4 shrink-0" aria-hidden />
        </span>
        <span className="text-sm font-semibold">Clinic treatments</span>
      </h2>

      <p className="mb-3 text-[11px] leading-snug text-[#1E1B31]/55">
        Send offline in-clinic treatment pre- and post-care guides to the patient chat.
      </p>

      {allTreatments.length === 0 ? (
        <p className={`${doctorEmptyStateClass} mb-3 px-2 py-3 text-[11px]`}>
          No treatments in your list. Add one below or restore a hidden preset.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#1E1B31]">
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

            {selected ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(selected)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#1E1B31]/15 px-2.5 py-1 text-[10px] font-semibold text-[#1E1B31] hover:bg-[#F8F9FC]"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  {selected.isBuiltIn ? "Hide" : "Delete"}
                </button>
              </div>
            ) : null}

            <div className="flex gap-1">
              {(["pre", "post"] as const).map((phase) => (
                <button
                  key={phase}
                  type="button"
                  onClick={() => setPreviewPhase(phase)}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                    previewPhase === phase
                      ? "bg-[#1E1B31] text-white"
                      : "bg-[#F1F4FA] text-[#1E1B31]/70 hover:bg-[#E8EDF6]"
                  }`}
                >
                  {phase === "pre" ? "Pre-care" : "Post-care"}
                </button>
              ))}
            </div>

            <div className={`${doctorPatientPagePanelClass} p-3`}>
              {selected ? (
                previewPhase === "pre" ? (
                  <CareList title="Pre-care" items={selected.preCare} />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
                        Do
                      </p>
                      <CareList title="Do" items={selected.postCareDos} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
                        Avoid
                      </p>
                      <CareList title="Avoid" items={selected.postCareDonts} />
                    </div>
                  </div>
                )
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sendBusy !== null || !selected}
                onClick={() => void sendCare("pre")}
                className={`${doctorBtnPrimarySmClass} inline-flex items-center gap-1`}
              >
                <Send className="h-3 w-3" aria-hidden />
                {sendBusy === "pre" ? "Sending…" : "Send pre-care to chat"}
              </button>
              <button
                type="button"
                disabled={sendBusy !== null || !selected}
                onClick={() => void sendCare("post")}
                className={`${doctorBtnPrimarySmClass} inline-flex items-center gap-1`}
              >
                <Send className="h-3 w-3" aria-hidden />
                {sendBusy === "post" ? "Sending…" : "Send post-care to chat"}
              </button>
            </div>

            {flash ? (
              <p className="inline-flex items-center gap-1 text-xs font-medium text-[#1E1B31]" role="status">
                <Check className="h-3.5 w-3.5" aria-hidden />
                <span>{flash}</span>
              </p>
            ) : null}
          </div>

          <div className={`${doctorPatientPagePanelClass} flex min-h-[12rem] flex-col p-3`}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
              Chat preview
            </p>
            <pre className="flex-1 whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-[#1E1B31]/85">
              {previewText}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[#1E1B31]/10 pt-3">
        <button
          type="button"
          onClick={() => {
            if (manageOpen && formMode) resetForm();
            setManageOpen((v) => !v);
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs font-semibold text-[#1E1B31] hover:bg-[#F8F9FC]"
          aria-expanded={manageOpen}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Manage treatments
          </span>
          <ChevronDown
            className={`h-4 w-4 text-[#1E1B31]/45 transition ${manageOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {manageOpen ? (
          <div className="mt-3 space-y-4">
            {formMode ? (
              <div className={`${doctorPatientPagePanelClass} p-3`}>
                <p className="mb-2 text-[11px] font-semibold text-[#1E1B31]">
                  {formMode === "add" ? "Add treatment" : "Edit treatment"}
                </p>
                <TreatmentForm
                  draftName={draftName}
                  draftPre={draftPre}
                  draftDos={draftDos}
                  draftDonts={draftDonts}
                  onNameChange={setDraftName}
                  onPreChange={setDraftPre}
                  onDosChange={setDraftDos}
                  onDontsChange={setDraftDonts}
                  onSubmit={submitForm}
                  onCancel={resetForm}
                  submitLabel={formMode === "add" ? "Add treatment" : "Update treatment"}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={startAdd}
                className={`${doctorBtnPrimarySmClass} inline-flex items-center gap-1`}
              >
                <Plus className="h-3 w-3" aria-hidden />
                Add new treatment
              </button>
            )}

            {allTreatments.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
                  Your treatments
                </p>
                {allTreatments.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#1E1B31]/10 bg-[#FAFBFD] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-[#1E1B31]">
                        {t.name}
                      </p>
                      <p className="text-[10px] text-[#1E1B31]/45">
                        {t.isBuiltIn ? "Preset" : "Custom"} · {t.preCare.length} pre ·{" "}
                        {t.postCareDos.length + t.postCareDonts.length} post
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="rounded-md p-1.5 text-[#1E1B31]/70 hover:bg-white"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        title={t.isBuiltIn ? "Hide" : "Delete"}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {hiddenBuiltIn.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#1E1B31]/50">
                  Hidden presets
                </p>
                {hiddenBuiltIn.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#1E1B31]/15 px-2.5 py-2"
                  >
                    <span className="text-[11px] text-[#1E1B31]/70">{t.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        restore(t.id);
                        setSelectedId(t.id);
                        setFlash(`${t.name} restored.`);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E1B31] hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden />
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : allTreatments.length <= 1 ? (
          <p className={`${doctorEmptyStateClass} mt-2 px-2 py-3 text-[11px]`}>
            Open manage to add, edit, or hide clinic treatment guides.
          </p>
        ) : null}
      </div>
    </div>
  );
}
