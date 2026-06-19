"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import type { DoctorScanReportPayload } from "@/src/lib/doctorScanReportPayload";
import { patientClarityToGrade } from "@/src/lib/clarityGrade";
import {
  DOCTOR_EDITABLE_MFS_KEYS,
  type DoctorEditableMfsKey,
} from "@/src/lib/resolveScanDisplayScores";
import {
  doctorPatientPageFormInputClass,
  doctorPatientPageNavyBtnGhostClass,
  doctorPatientPageNavyBtnPrimaryClass,
  doctorPatientPageNavyInsetClass,
  doctorPatientPageRowClass,
} from "@/components/doctor/DoctorUiPrimitives";

const PARAM_LABELS: Record<DoctorEditableMfsKey, string> = {
  active_acne: "Active acne",
  acne_scars: "Acne scars",
  wrinkle_severity: "Wrinkles",
  sagging_volume: "Sagging & volume",
  under_eye: "Under-eye",
  pigmentation_model: "Pigmentation",
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampSeverity(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Converts model severity 1-5 to clarity 0-100 (higher is better). */
function severityToClarityPercent(severity: number): number {
  return clampPct(100 - ((clampSeverity(severity) - 1) / 4) * 100);
}

function initialSeverity(
  report: DoctorScanReportPayload,
  key: DoctorEditableMfsKey
): number {
  const fromClinical = report.metrics.clinical_scores?.[key];
  if (typeof fromClinical === "number" && Number.isFinite(fromClinical)) {
    return clampSeverity(fromClinical);
  }
  const fromAi = report.scoreEdit.aiBase.modelFeatureScores[key];
  if (typeof fromAi === "number" && Number.isFinite(fromAi)) {
    return clampSeverity(fromAi);
  }
  return 3;
}

function buildFormState(report: DoctorScanReportPayload) {
  const modelFeatureScores = {} as Record<DoctorEditableMfsKey, number>;
  for (const key of DOCTOR_EDITABLE_MFS_KEYS) {
    modelFeatureScores[key] = initialSeverity(report, key);
  }
  return {
    kaiScore: clampPct(report.metrics.overall_score),
    modelFeatureScores,
  };
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

  const kaiGrade = useMemo(
    () => patientClarityToGrade(form.kaiScore),
    [form.kaiScore]
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
      throw new Error(j.error ?? "SAVE_FAILED");
    }
  }

  async function handleSave() {
    setBusy(true);
    setErr(null);
    setFlash(null);
    try {
      await patchScores({
        kaiScore: form.kaiScore,
        modelFeatureScores: form.modelFeatureScores,
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
            Override kAI and six skin parameters. Patient sees updates after save.
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
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={form.kaiScore}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  kaiScore: clampPct(Number(e.target.value)),
                }))
              }
              className={`${doctorPatientPageFormInputClass} w-24 tabular-nums`}
            />
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
        {DOCTOR_EDITABLE_MFS_KEYS.map((key) => {
          const severity = form.modelFeatureScores[key];
          const clarity = severityToClarityPercent(severity);
          const aiSeverity = report.scoreEdit.aiBase.modelFeatureScores[key];
          return (
            <div
              key={key}
              className={`${doctorPatientPageRowClass} flex items-center justify-between gap-2 py-2`}
            >
              <dt className="min-w-0 flex-1">
                <p className="text-xs text-[#2C3E6B]/70">{PARAM_LABELS[key]}</p>
                {typeof aiSeverity === "number" ? (
                  <p className="text-[10px] text-[#2C3E6B]/45">
                    AI: severity {aiSeverity} ({severityToClarityPercent(aiSeverity)})
                  </p>
                ) : null}
              </dt>
              <dd className="flex shrink-0 items-center gap-2">
                <select
                  value={severity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      modelFeatureScores: {
                        ...prev.modelFeatureScores,
                        [key]: clampSeverity(Number(e.target.value)),
                      },
                    }))
                  }
                  className={`${doctorPatientPageFormInputClass} w-16 tabular-nums`}
                  aria-label={`${PARAM_LABELS[key]} severity`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="w-10 text-right text-sm font-bold tabular-nums text-[#2C3E6B]">
                  {clarity}
                </span>
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
