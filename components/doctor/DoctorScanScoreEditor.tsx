"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import { PATIENT_DISPLAY_SCORE_CAP, patientClarityToGrade } from "@/src/lib/clarityGrade";
import { computeRagKaiScore } from "@/src/lib/ragEightParams";
import {
  doctorPatientPageFormInputClass,
  doctorPatientPageNavyBtnGhostClass,
  doctorPatientPageNavyBtnPrimaryClass,
  doctorPatientPageNavyInsetClass,
  doctorPatientPageRowClass,
} from "@/components/doctor/DoctorUiPrimitives";

const PARAM_KEYS = [
  "active_acne",
  "sagging_volume",
  "wrinkles",
  "acne_scar",
  "under_eye",
  "pigmentation",
] as const;

export type EditableParamKey = (typeof PARAM_KEYS)[number];

const PARAM_LABELS: Record<EditableParamKey, string> = {
  active_acne: "Active Acne",
  sagging_volume: "Sagging & Volume",
  wrinkles: "Wrinkles",
  acne_scar: "Acne Scar",
  under_eye: "Under Eye",
  pigmentation: "Pigmentation",
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(PATIENT_DISPLAY_SCORE_CAP, Math.round(n)));
}

function initialParamScore(
  report: DoctorScanReportPayload,
  key: EditableParamKey
): number {
  const fromCurrent = report.scoreEdit.currentDisplay?.parameterScores?.[key];
  if (typeof fromCurrent === "number" && Number.isFinite(fromCurrent)) {
    return clampPct(fromCurrent);
  }
  const fromOverrides = report.scoreEdit.doctorOverrides?.parameterScores?.[key];
  if (typeof fromOverrides === "number" && Number.isFinite(fromOverrides)) {
    return clampPct(fromOverrides);
  }
  const fromAi = report.scoreEdit.aiBase.parameterScores?.[key];
  if (typeof fromAi === "number" && Number.isFinite(fromAi)) {
    return clampPct(fromAi);
  }
  return 70;
}

function buildFormState(report: DoctorScanReportPayload) {
  const parameterScores = {} as Record<EditableParamKey, number>;
  for (const key of PARAM_KEYS) {
    parameterScores[key] = initialParamScore(report, key);
  }
  return {
    parameterScores,
  };
}

function kaiFromParameterScores(
  parameterScores: Record<EditableParamKey, number>
): number {
  return computeRagKaiScore(parameterScores) ?? 70;
}

function formatDoctorScoreSaveError(code: string | undefined): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "Session expired — sign in again.";
    case "NOT_FOUND":
      return "Scan not found for this patient.";
    case "kaiScore_REQUIRED":
      return "Enter a kAI score (0–100) before saving.";
    case "INVALID_SEVERITY_VALUE":
      return "One of the severity values is invalid.";
    case "INVALID_PARAM_SCORE_VALUE":
      return "One of the parameter score values is invalid.";
    case "INVALID_JSON":
    case "INVALID_BODY":
      return "Invalid save request — refresh and try again.";
    default:
      return code?.trim() ? code.replace(/_/g, " ") : "Could not save scores.";
  }
}

export function DoctorScanScoreEditor({
  patientId,
  scanId,
  report,
  onSaved,
}: {
  patientId: string;
  scanId: number;
  report: DoctorScanReportPayload;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => buildFormState(report));
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildFormState(report));
  }, [report]);

  const kaiScore = useMemo(
    () => kaiFromParameterScores(form.parameterScores),
    [form.parameterScores]
  );

  const kaiGrade = useMemo(
    () => patientClarityToGrade(kaiScore),
    [kaiScore]
  );

  async function patchScores(body: Record<string, unknown>) {
    const res = await fetch(
      `/api/doctor/patients/${encodeURIComponent(patientId)}/scans/${scanId}/scores`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(formatDoctorScoreSaveError(j.error));
    }
  }

  async function handleSave() {
    setBusy(true);
    setErr(null);
    setFlash(null);
    try {
      await patchScores({
        kaiScore,
        parameterScores: form.parameterScores,
      });
      setFlash("Scores saved. Patient notified via clinic support chat.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save scores.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        "Reset this scan to AI values? Doctor overrides will be removed."
      )
    ) {
      return;
    }
    setResetBusy(true);
    setErr(null);
    setFlash(null);
    try {
      await patchScores({ reset: true });
      setFlash("Reset to AI scores.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not reset scores.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <section className={`${doctorPatientPageNavyInsetClass} space-y-3 p-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-[#2C3E6B]">Adjust scores</h4>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#2C3E6B]/60">
            Patient-facing scores (capped below 80). kAI updates from their weighted sum.
          </p>
        </div>
        {report.scoreEdit.hasOverrides ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
            Doctor adjusted
          </span>
        ) : null}
      </div>

      <div className={`${doctorPatientPageRowClass} flex flex-wrap items-center gap-3 py-2`}>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-xs text-[#2C3E6B]/70">kAI score (0–100)</span>
          <div className="flex items-center gap-2">
            <output
              className={`${doctorPatientPageFormInputClass} w-24 tabular-nums`}
              aria-live="polite"
            >
              {kaiScore}
            </output>
            <span className="rounded-md bg-[#2C3E6B]/8 px-2 py-1 text-sm font-bold text-[#2C3E6B]">
              {kaiGrade}
            </span>
          </div>
          <span className="text-[10px] text-[#2C3E6B]/45">
            AI baseline: {report.scoreEdit.aiBase.kaiScore}
          </span>
        </label>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        {PARAM_KEYS.map((key) => {
          const score = form.parameterScores[key];
          const aiScore = report.scoreEdit.aiBase.parameterScores?.[key];
          return (
            <div
              key={key}
              className={`${doctorPatientPageRowClass} flex items-center justify-between gap-2 py-2`}
            >
              <dt className="min-w-0 flex-1">
                <p className="text-xs text-[#2C3E6B]/70">{PARAM_LABELS[key]}</p>
                {typeof aiScore === "number" ? (
                  <p className="text-[10px] text-[#2C3E6B]/45">
                    AI baseline: {aiScore}
                  </p>
                ) : null}
              </dt>
              <dd className="flex shrink-0 items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={score}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      parameterScores: {
                        ...prev.parameterScores,
                        [key]: clampPct(Number(e.target.value)),
                      },
                    }))
                  }
                  className={`${doctorPatientPageFormInputClass} w-20 tabular-nums`}
                  aria-label={`${PARAM_LABELS[key]} score`}
                />
              </dd>
            </div>
          );
        })}
      </dl>

      {err ? (
        <p className="text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      {flash ? (
        <p className="text-xs text-emerald-700" role="status">
          {flash}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy || resetBusy}
          onClick={() => void handleSave()}
          className={doctorPatientPageNavyBtnPrimaryClass}
        >
          <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {busy ? "Saving…" : "Save scores"}
        </button>
        {report.scoreEdit.hasOverrides ? (
          <button
            type="button"
            disabled={busy || resetBusy}
            onClick={() => void handleReset()}
            className={doctorPatientPageNavyBtnGhostClass}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {resetBusy ? "Resetting…" : "Reset to AI"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
