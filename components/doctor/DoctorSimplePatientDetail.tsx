"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  formatOnboardingAnswer,
  sortQuestionnaireAnswers,
} from "@/src/lib/onboardingQuestionnaireDisplay";

type Patient = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  age: number | null;
  skinType: string | null;
  primaryConcern: string | null;
  concernSeverity: string | null;
  fitzpatrick: string | null;
  clinicVisitedAt: string | null;
};

type ScanRow = {
  id: number;
  scanName: string | null;
  overallScore: number;
  createdAt: string;
  imageDoctorUrl?: string;
  aiSummary: string | null;
};

type QaRow = {
  id: string;
  questionId: string;
  answer: unknown;
};

type ChatMsg = {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
};

type ReportPayload = {
  scanTitle?: string | null;
  aiSummary?: string | null;
  metrics?: {
    overall_score?: number;
    acne?: number;
    pigmentation?: number;
    wrinkles?: number;
    hydration?: number;
    texture?: number;
  };
  faceCaptureGallery?: Array<{ label: string; imageUrl: string }>;
  imageUrl?: string;
};

export function DoctorSimplePatientDetail({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [qa, setQa] = useState<QaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOn, setChatOn] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [reportScanId, setReportScanId] = useState<number | null>(null);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    const res = await fetch(
      `/api/doctor/patients/${patientId}?section=profile,scans,activity`,
      { credentials: "include", cache: "no-store" }
    );
    const data = (await res.json()) as {
      success?: boolean;
      patient?: Patient;
      scans?: ScanRow[];
      questionnaireAnswers?: QaRow[];
    };
    if (!res.ok || data.success === false) {
      throw new Error("Could not load patient.");
    }
    setPatient(data.patient ?? null);
    setChatOn(Boolean(data.patient?.clinicVisitedAt));
    setScans(data.scans ?? []);
    setQa(data.questionnaireAnswers ?? []);
  }, [patientId]);

  const loadChat = useCallback(async () => {
    const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = (await res.json()) as { ok?: boolean; messages?: ChatMsg[] };
    if (res.ok && data.ok) setMessages(data.messages ?? []);
  }, [patientId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await loadProfile();
        await loadChat();
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Could not load patient.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadProfile, loadChat]);

  useEffect(() => {
    if (!chatOn) return;
    const id = window.setInterval(() => void loadChat(), 5000);
    return () => window.clearInterval(id);
  }, [chatOn, loadChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function toggleChat(next: boolean) {
    setChatBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clinicVisited: next }),
      });
      if (!res.ok) throw new Error("Could not update chat access.");
      setChatOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update chat access.");
    } finally {
      setChatBusy(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !chatOn) return;
    setSendBusy(true);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Could not send.");
      setDraft("");
      await loadChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSendBusy(false);
    }
  }

  async function openReport(scanId: number) {
    setReportScanId(scanId);
    setReportBusy(true);
    setReport(null);
    try {
      const res = await fetch(
        `/api/doctor/patients/${patientId}/scans/${scanId}/report`,
        { credentials: "include", cache: "no-store" }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        report?: ReportPayload;
      };
      if (!res.ok || !data.ok) throw new Error("Could not load report.");
      setReport(data.report ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report.");
    } finally {
      setReportBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[#1E1B31]/55">Loading…</p>;
  }
  if (!patient) {
    return (
      <p className="text-sm text-rose-700">{error ?? "Patient not found."}</p>
    );
  }

  const displayName = patient.name?.trim() || patient.email || "Patient";
  const phone = [patient.phoneCountryCode, patient.phone]
    .filter(Boolean)
    .join(" ");
  const qaSorted = sortQuestionnaireAnswers(qa);

  return (
    <div className="space-y-6">
      <Link
        href="/clinic/patients"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Patients
      </Link>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-2xl font-bold text-[#1E1B31]">
              {displayName}
            </h1>
            <p className="mt-0.5 text-sm text-[#1E1B31]/55">{patient.email}</p>
          </div>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => void toggleChat(!chatOn)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
              chatOn
                ? "bg-[#1E1B31] text-white"
                : "border border-[#1E1B31]/15 text-[#1E1B31]"
            }`}
          >
            {chatBusy ? "Saving…" : chatOn ? "Chat enabled" : "Allow chat"}
          </button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Phone" value={phone || "—"} />
          <Info label="Age" value={patient.age != null ? String(patient.age) : "—"} />
          <Info label="Skin type" value={patient.skinType || "—"} />
          <Info label="Concern" value={patient.primaryConcern || "—"} />
          <Info label="Severity" value={patient.concernSeverity || "—"} />
          <Info label="Fitzpatrick" value={patient.fitzpatrick || "—"} />
        </dl>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
          Chat
        </h2>
        {!chatOn ? (
          <p className="mt-2 text-sm text-[#1E1B31]/55">
            Chat is off. Enable it so this patient can message you from the app,
            then reply here.
          </p>
        ) : (
          <>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-[#FAF8F5] p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-[#1E1B31]/45">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.sender === "doctor"
                        ? "ml-auto bg-[#1E1B31] text-white"
                        : "bg-white text-[#1E1B31] shadow-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        m.sender === "doctor" ? "text-white/60" : "text-[#1E1B31]/40"
                      }`}
                    >
                      {format(parseISO(m.createdAt), "d MMM, HH:mm")}
                    </p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Reply to patient"
                className="min-w-0 flex-1 rounded-xl border border-[#1E1B31]/12 bg-[#FAF8F5] px-3 py-2 text-sm outline-none focus:border-[#1E1B31]/35"
              />
              <button
                type="submit"
                disabled={sendBusy || !draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E1B31] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                Send
              </button>
            </form>
          </>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
          Reports
        </h2>
        {scans.length === 0 ? (
          <p className="mt-2 text-sm text-[#1E1B31]/55">No scans yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scans.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void openReport(s.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-left text-sm hover:bg-[#F0EAE2]"
                >
                  <span className="font-semibold text-[#1E1B31]">
                    {s.scanName?.trim() || `Scan ${s.id}`}
                  </span>
                  <span className="text-xs text-[#1E1B31]/50">
                    {format(parseISO(s.createdAt), "d MMM yyyy")} · score{" "}
                    {Math.round(s.overallScore)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {reportBusy ? (
          <p className="mt-3 text-sm text-[#1E1B31]/55">Loading report…</p>
        ) : null}
        {report && reportScanId != null ? (
          <div className="mt-4 space-y-3 rounded-xl border border-[#1E1B31]/10 p-4">
            <p className="font-semibold text-[#1E1B31]">
              {report.scanTitle || `Scan ${reportScanId}`}
            </p>
            {report.aiSummary ? (
              <p className="text-sm leading-relaxed text-[#1E1B31]/80">
                {report.aiSummary}
              </p>
            ) : null}
            {report.metrics ? (
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {Object.entries({
                  Overall: report.metrics.overall_score,
                  Acne: report.metrics.acne,
                  Pigment: report.metrics.pigmentation,
                  Wrinkles: report.metrics.wrinkles,
                  Hydration: report.metrics.hydration,
                  Texture: report.metrics.texture,
                }).map(([k, v]) =>
                  typeof v === "number" ? (
                    <div key={k} className="rounded-lg bg-[#FAF8F5] px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase text-[#1E1B31]/45">
                        {k}
                      </p>
                      <p className="font-bold text-[#1E1B31]">{Math.round(v)}</p>
                    </div>
                  ) : null
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(report.faceCaptureGallery?.length
                ? report.faceCaptureGallery
                : report.imageUrl
                  ? [{ label: "Front", imageUrl: report.imageUrl }]
                  : []
              ).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.imageUrl}
                  src={img.imageUrl}
                  alt={img.label}
                  className="h-28 w-28 rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(72,64,48,0.07)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#1E1B31]/50">
          Questionnaire
        </h2>
        {qaSorted.length === 0 ? (
          <p className="mt-2 text-sm text-[#1E1B31]/55">No answers yet.</p>
        ) : (
          <dl className="mt-3 space-y-3">
            {qaSorted.map((row) => {
              const display = formatOnboardingAnswer(row.questionId, row.answer);
              return (
                <div key={row.id}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
                    {display.title}
                  </dt>
                  <dd className="text-sm text-[#1E1B31]">
                    {display.tags.length > 0
                      ? display.tags.join(", ")
                      : display.body}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#1E1B31]/45">
        {label}
      </dt>
      <dd className="text-sm text-[#1E1B31]">{value}</dd>
    </div>
  );
}
