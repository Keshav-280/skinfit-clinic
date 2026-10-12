"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Gift,
  LayoutGrid,
  MessageSquare,
  Send,
  Syringe,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  formatOnboardingAnswer,
  sortQuestionnaireAnswers,
} from "@/src/lib/onboardingQuestionnaireDisplay";
import { CLINIC, initialsOf } from "@/components/doctor/clinicUi";
import { ClinicPatientReportUploads } from "@/components/doctor/ClinicPatientReportUploads";
import { DoctorPatientCareSchedulePanel } from "@/components/doctor/DoctorPatientCareSchedulePanel";
import { DoctorPatientTreatmentsPanel } from "@/components/doctor/DoctorPatientTreatmentsPanel";
import { DoctorRewardsClient } from "@/components/doctor/DoctorRewardsClient";

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

type TabId = "overview" | "treatments" | "schedule" | "reports" | "chat" | "rewards";

const TABS: Array<{ id: TabId; label: string; icon: typeof LayoutGrid }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "treatments", label: "Treatments", icon: Syringe },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "rewards", label: "Rewards", icon: Gift },
];

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
  const [tab, setTab] = useState<TabId>("overview");
  const [points, setPoints] = useState<number | null>(null);
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

  const loadPoints = useCallback(async () => {
    try {
      const res = await fetch(`/api/doctor/rewards/patients/${patientId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { summary?: { balance?: number } };
      if (typeof data.summary?.balance === "number") setPoints(data.summary.balance);
    } catch {
      /* points are optional here */
    }
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
    void loadPoints();
  }, [loadPoints, tab]);

  useEffect(() => {
    if (!chatOn) return;
    const id = window.setInterval(() => void loadChat(), 5000);
    return () => window.clearInterval(id);
  }, [chatOn, loadChat]);

  useEffect(() => {
    if (tab === "chat") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, tab]);

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
    return <p className={CLINIC.muted}>Loading…</p>;
  }
  if (!patient) {
    return <p className={CLINIC.noteError}>{error ?? "Patient not found."}</p>;
  }

  const displayName = patient.name?.trim() || patient.email || "Patient";
  const phone = [patient.phoneCountryCode, patient.phone].filter(Boolean).join(" ");
  const qaSorted = sortQuestionnaireAnswers(qa);
  const latest = scans[0];

  return (
    <div className="space-y-5">
      <Link
        href="/clinic/patients"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E1B31] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Patients
      </Link>

      {error ? <p className={CLINIC.noteError}>{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl bg-[#1E1B31] p-5 text-white lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#AEB9E8] text-base font-semibold text-[#1E1B31]"
              aria-hidden
            >
              {initialsOf(displayName)}
            </span>
            <div className="min-w-0">
              <h1 className="font-headline truncate text-xl font-semibold leading-tight">
                {displayName}
              </h1>
              <p className="truncate text-xs text-[#AEB9E8]">{patient.email}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#AEB9E8]">Phone</dt>
              <dd className="text-right">{phone || "-"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#AEB9E8]">Age</dt>
              <dd>{patient.age != null ? patient.age : "-"}</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[patient.primaryConcern, patient.skinType, patient.concernSeverity]
              .filter((v): v is string => Boolean(v))
              .map((v) => (
                <span
                  key={v}
                  className="rounded-full bg-[#2B2F63] px-2.5 py-0.5 text-[11px] font-semibold text-[#AEB9E8]"
                >
                  {v}
                </span>
              ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#2B2F63] pt-4 text-center">
            <div>
              <p className="font-headline text-xl font-semibold">{scans.length}</p>
              <p className="text-[11px] text-[#AEB9E8]">Scans</p>
            </div>
            <div>
              <p className="font-headline text-xl font-semibold">
                {latest ? Math.round(latest.overallScore) : "-"}
              </p>
              <p className="text-[11px] text-[#AEB9E8]">Latest score</p>
            </div>
            <div>
              <p className="font-headline text-xl font-semibold text-[#DF9DA4]">
                {points ?? "-"}
              </p>
              <p className="text-[11px] text-[#AEB9E8]">Points</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setTab("rewards")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#1E1B31] transition hover:bg-[#F0EAE2]"
            >
              <Gift className="h-4 w-4" aria-hidden />
              Record a visit
            </button>
            <button
              type="button"
              disabled={chatBusy}
              onClick={() => void toggleChat(!chatOn)}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                chatOn
                  ? "border border-[#5B66A1] text-white hover:bg-[#2B2F63]"
                  : "bg-[#DF9DA4] text-[#1E1B31] hover:bg-[#d58e96]"
              }`}
            >
              {chatBusy ? "Saving…" : chatOn ? "Chat enabled" : "Allow chat"}
            </button>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <nav
            className="-mx-1 flex gap-1 overflow-x-auto border-b border-[#E4E6F0] px-1"
            aria-label="Patient sections"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
                  tab === id
                    ? "border-[#1E1B31] font-semibold text-[#1E1B31]"
                    : "border-transparent font-medium text-[#5B66A1] hover:text-[#1E1B31]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={CLINIC.tile}>
                  <p className={CLINIC.label}>Latest score</p>
                  <p className="font-headline mt-1 text-2xl font-semibold text-[#1E1B31]">
                    {latest ? Math.round(latest.overallScore) : "-"}
                  </p>
                </div>
                <div className={CLINIC.tile}>
                  <p className={CLINIC.label}>Scans taken</p>
                  <p className="font-headline mt-1 text-2xl font-semibold text-[#1E1B31]">
                    {scans.length}
                  </p>
                </div>
                <div className={CLINIC.tile}>
                  <p className={CLINIC.label}>Last scan</p>
                  <p className="font-headline mt-1 text-2xl font-semibold text-[#1E1B31]">
                    {latest ? format(parseISO(latest.createdAt), "d MMM") : "-"}
                  </p>
                </div>
                <div className={CLINIC.tile}>
                  <p className={CLINIC.label}>Reward points</p>
                  <p className="font-headline mt-1 text-2xl font-semibold text-[#1E1B31]">
                    {points ?? "-"}
                  </p>
                </div>
              </div>

              <section className={CLINIC.cardPad}>
                <h2 className={CLINIC.h2}>Patient details</h2>
                <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                  <Info label="Skin type" value={patient.skinType || "-"} />
                  <Info label="Concern" value={patient.primaryConcern || "-"} />
                  <Info label="Severity" value={patient.concernSeverity || "-"} />
                  <Info label="Fitzpatrick" value={patient.fitzpatrick || "-"} />
                  <Info label="Phone" value={phone || "-"} />
                  <Info label="Age" value={patient.age != null ? String(patient.age) : "-"} />
                </dl>
              </section>

              <section className={CLINIC.cardPad}>
                <h2 className={CLINIC.h2}>Questionnaire</h2>
                {qaSorted.length === 0 ? (
                  <p className={`mt-2 ${CLINIC.muted}`}>No answers yet.</p>
                ) : (
                  <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                    {qaSorted.map((row) => {
                      const display = formatOnboardingAnswer(row.questionId, row.answer);
                      return (
                        <div key={row.id}>
                          <dt className={CLINIC.label}>{display.title}</dt>
                          <dd className="mt-0.5 text-sm text-[#1E1B31]">
                            {display.tags.length > 0 ? display.tags.join(", ") : display.body}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </section>
            </div>
          ) : null}

          {tab === "treatments" ? (
            <DoctorPatientTreatmentsPanel patientId={patientId} variant="simple" />
          ) : null}

          {tab === "schedule" ? (
            <DoctorPatientCareSchedulePanel patientId={patientId} variant="simple" />
          ) : null}

          {tab === "reports" ? (
            <div className="space-y-4">
              <section className={CLINIC.cardPad}>
                <h2 className={CLINIC.h2}>Scan reports</h2>
                {scans.length === 0 ? (
                  <p className={`mt-2 ${CLINIC.muted}`}>No scans yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {scans.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => void openReport(s.id)}
                          className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm transition ${
                            reportScanId === s.id
                              ? "bg-[#E8ECFC]"
                              : "bg-[#FAF8F5] hover:bg-[#F0EAE2]"
                          }`}
                        >
                          <span className="font-semibold text-[#1E1B31]">
                            {s.scanName?.trim() || `Scan ${s.id}`}
                          </span>
                          <span className="text-xs text-[#5B66A1]">
                            {format(parseISO(s.createdAt), "d MMM yyyy")} | score{" "}
                            {Math.round(s.overallScore)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {reportBusy ? <p className={`mt-3 ${CLINIC.muted}`}>Loading report…</p> : null}
                {report && reportScanId != null ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-[#E4E6F0] p-4">
                    <p className="font-headline text-base font-semibold text-[#1E1B31]">
                      {report.scanTitle || `Scan ${reportScanId}`}
                    </p>
                    {report.aiSummary ? (
                      <p className="text-sm leading-relaxed text-[#1E1B31]/80">
                        {report.aiSummary}
                      </p>
                    ) : null}
                    {report.metrics ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {Object.entries({
                          Overall: report.metrics.overall_score,
                          Acne: report.metrics.acne,
                          Pigment: report.metrics.pigmentation,
                          Wrinkles: report.metrics.wrinkles,
                          Hydration: report.metrics.hydration,
                          Texture: report.metrics.texture,
                        }).map(([k, v]) =>
                          typeof v === "number" ? (
                            <div key={k} className={CLINIC.tile}>
                              <p className={CLINIC.label}>{k}</p>
                              <p className="font-headline mt-0.5 text-lg font-semibold text-[#1E1B31]">
                                {Math.round(v)}
                              </p>
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

              <ClinicPatientReportUploads patientId={patientId} />
            </div>
          ) : null}

          {tab === "chat" ? (
            <section className={CLINIC.cardPad}>
              <h2 className={CLINIC.h2}>Chat</h2>
              {!chatOn ? (
                <p className={`mt-2 ${CLINIC.muted}`}>
                  Chat is off. Turn on &ldquo;Allow chat&rdquo; so this patient can message you
                  from the app, then reply here.
                </p>
              ) : (
                <>
                  <div className="mt-3 max-h-96 space-y-2 overflow-y-auto rounded-xl bg-[#FAF8F5] p-3">
                    {messages.length === 0 ? (
                      <p className={CLINIC.muted}>No messages yet.</p>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                            m.sender === "doctor"
                              ? "ml-auto bg-[#1E1B31] text-white"
                              : "bg-[#F0EAE2] text-[#1E1B31]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              m.sender === "doctor" ? "text-[#AEB9E8]" : "text-[#5B66A1]"
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
                      className={`min-w-0 flex-1 ${CLINIC.input}`}
                    />
                    <button
                      type="submit"
                      disabled={sendBusy || !draft.trim()}
                      className={CLINIC.btnPrimary}
                    >
                      <Send className="h-4 w-4" aria-hidden />
                      Send
                    </button>
                  </form>
                </>
              )}
            </section>
          ) : null}

          {tab === "rewards" ? (
            <DoctorRewardsClient initialPatientId={patientId} embedded />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={CLINIC.label}>{label}</dt>
      <dd className="mt-0.5 text-sm text-[#1E1B31]">{value}</dd>
    </div>
  );
}
