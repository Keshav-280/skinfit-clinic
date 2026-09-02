"use client";

import QRCode from "qrcode";
import {
  Archive,
  ArchiveRestore,
  Download,
  Eye,
  Mail,
  QrCode,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KAI_REPORT_EVENT_LABEL } from "@/src/lib/sdetectReport/eventLabel";
import { resolveOutputBasename } from "@/src/lib/sdetectReport/outputFilename";

type ClinicReportRow = {
  id: string;
  patientEmail: string | null;
  patientName: string | null;
  title: string;
  status: "draft" | "pending_account" | "sent";
  hasPdf: boolean;
  hasEmail: boolean;
  accountCreated: boolean;
  sentAt: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  shareUrl: string | null;
  kind: "external_clinic_report";
};

type ClinicReportPatientPick = {
  name: string;
  email: string;
  lastUsedAt: string;
};

type CreateTab = "generate" | "upload";

function PatientEmailSelect({
  patients,
  value,
  onChange,
  placeholder = "Select patient…",
  className = "",
}: {
  patients: ClinicReportPatientPick[];
  value: string;
  onChange: (email: string, patient: ClinicReportPatientPick | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const email = e.target.value;
        const patient = patients.find((p) => p.email === email) ?? null;
        onChange(email, patient);
      }}
      disabled={patients.length === 0}
      className={className}
    >
      <option value="">
        {patients.length === 0 ? "No patients with email yet" : placeholder}
      </option>
      {patients.map((p) => (
        <option key={p.email} value={p.email}>
          {p.name} - {p.email}
        </option>
      ))}
    </select>
  );
}

function statusLabel(row: ClinicReportRow): { text: string; className: string } {
  if (row.status === "draft" && !row.hasPdf) {
    return {
      text: "Awaiting PDF",
      className: "bg-sky-50 text-sky-800 border border-sky-200",
    };
  }
  if (row.status === "draft" && row.hasPdf && !row.hasEmail) {
    return {
      text: "Saved - assign patient to send",
      className: "bg-violet-50 text-violet-800 border border-violet-200",
    };
  }
  if (row.status === "draft") {
    return { text: "Draft", className: "bg-zinc-100 text-zinc-700" };
  }
  if (row.status === "pending_account") {
    return {
      text: "Sent - account not created",
      className: "bg-amber-50 text-amber-800 border border-amber-200",
    };
  }
  if (row.accountCreated) {
    return {
      text: "Delivered to patient",
      className: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    };
  }
  return { text: "Sent", className: "bg-blue-50 text-blue-800" };
}

function pickGeneratorFile(
  f: File,
  patientName: string,
  setFile: (file: File) => void,
  setOutputName: (name: string) => void
) {
  setFile(f);
  setOutputName(resolveOutputBasename(patientName, f.name));
}

type ListView = "active" | "archived";

export function DoctorClinicReportsClient() {
  const searchParams = useSearchParams();
  const generatorInputRef = useRef<HTMLInputElement>(null);
  const savedListRef = useRef<HTMLDivElement>(null);

  const [createTab, setCreateTab] = useState<CreateTab>("generate");
  const [reports, setReports] = useState<ClinicReportRow[]>([]);
  const [recentPatients, setRecentPatients] = useState<ClinicReportPatientPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientEmail, setPatientEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [qrReport, setQrReport] = useState<ClinicReportRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<ClinicReportRow | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [listView, setListView] = useState<ListView>("active");
  const [patientPick, setPatientPick] = useState<Record<string, string>>({});
  const [updatingEmailId, setUpdatingEmailId] = useState<string | null>(null);

  // Upload tab
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Generate tab
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [outputName, setOutputName] = useState("");
  const [eventLabel, setEventLabel] = useState(KAI_REPORT_EVENT_LABEL);
  const [generating, setGenerating] = useState(false);
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "generate" || tab === "upload") {
      setCreateTab(tab);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/clinic-reports", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as {
        reports?: ClinicReportRow[];
        recentPatients?: ClinicReportPatientPick[];
      };
      setReports(data.reports ?? []);
      setRecentPatients(data.recentPatients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!qrReport?.shareUrl) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(qrReport.shareUrl, {
      width: 220,
      margin: 1,
      color: { dark: "#242a5f", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [qrReport]);

  function closePdfPreview() {
    setPreviewReport(null);
    setPreviewLoading(false);
    setPreviewPdfUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }

  useEffect(() => {
    if (!previewReport) return;

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewPdfUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });

    void (async () => {
      try {
        const blob = await fetchReportPdfBlob(previewReport.id);
        if (cancelled) return;
        if (!blob) {
          setError("Could not load PDF preview.");
          closePdfPreview();
          return;
        }
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) {
          setError("Could not load PDF preview.");
          closePdfPreview();
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewReport]);

  function scrollToSaved() {
    savedListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim()) return;
    setUploading(true);
    setError(null);
    setActionMsg(null);
    try {
      const form = new FormData();
      if (pdfFile) form.append("file", pdfFile);
      form.append("patientName", patientName.trim());
      if (patientEmail.trim()) form.append("patientEmail", patientEmail.trim());
      if (title.trim()) form.append("title", title.trim());
      const res = await fetch("/api/doctor/clinic-reports", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setPdfFile(null);
      setTitle("");
      setActionMsg(
        pdfFile
          ? patientEmail.trim()
            ? "Report saved. Use Send or Email below."
            : "Report saved. Add email below when ready."
          : patientEmail.trim()
            ? "Patient saved. Attach the PDF after the scan."
            : "Patient saved. Attach PDF after scan; add email when ready."
      );
      if (!pdfFile) {
        setPatientEmail("");
        setPatientName("");
      }
      await load();
      scrollToSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!sourceFile || !patientName.trim()) return;
    setGenerating(true);
    setError(null);
    setActionMsg(null);
    setLastReportId(null);
    try {
      const form = new FormData();
      form.append("file", sourceFile);
      form.append("patientName", patientName.trim());
      if (patientEmail.trim()) form.append("patientEmail", patientEmail.trim());
      if (outputName.trim()) form.append("outputName", outputName.trim());
      if (eventLabel.trim()) form.append("eventLabel", eventLabel.trim());

      const res = await fetch("/api/skinfit-report-generator", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.status === 401) {
        throw new Error("Please sign in to the doctor portal first.");
      }
      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? `Generation failed (${res.status})`);
        }
        const text = (await res.text().catch(() => "")).trim();
        throw new Error(text || `Generation failed (${res.status})`);
      }

      const reportId = res.headers.get("X-Clinic-Report-Id");
      if (reportId) setLastReportId(reportId);

      const attachedPending = res.headers.get("X-Clinic-Report-Attached-Pending") === "1";
      const downloadName =
        res.headers.get("X-Output-Filename") ??
        `${outputName.trim() || resolveOutputBasename(patientName, sourceFile.name)}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName.endsWith(".pdf") ? downloadName : `${downloadName}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setActionMsg(
        patientEmail.trim()
          ? attachedPending
            ? "SkinFit PDF generated and attached to an earlier entry. Use Send or Email below."
            : "SkinFit PDF generated and saved. Use Send or Email below."
          : "SkinFit PDF generated and saved. Add email below when ready."
      );
      await load();
      scrollToSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddEmailToSaved() {
    if (!lastReportId || !patientEmail.trim()) return;
    setUpdatingEmail(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${lastReportId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientEmail: patientEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      setActionMsg("Email added. Use Send or Email below.");
      await load();
      scrollToSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingEmail(false);
    }
  }

  async function attachPdfToReport(reportId: string, file: File) {
    setAttachingId(reportId);
    setError(null);
    setActionMsg(null);
    try {
      const row = reports.find((r) => r.id === reportId);
      const form = new FormData();
      form.append("file", file);
      form.append("patientName", row?.patientName?.trim() || "Patient");
      if (row?.patientEmail) form.append("patientEmail", row.patientEmail);
      form.append("attachToId", reportId);
      const res = await fetch("/api/doctor/clinic-reports", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Attach failed (${res.status})`);
      setActionMsg("PDF attached. You can now Send, email the patient, or show QR.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setAttachingId(null);
    }
  }

  async function assignPatientToReport(id: string) {
    const email = patientPick[id]?.trim();
    if (!email) return;
    const picked = recentPatients.find((p) => p.email === email);
    setUpdatingEmailId(id);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientEmail: email,
          ...(picked?.name ? { patientName: picked.name } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      setPatientPick((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActionMsg("Patient assigned. You can now Send or Email the report.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingEmailId(null);
    }
  }

  async function sendReport(id: string) {
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        patientMessage?: string;
      };
      if (!res.ok) {
        const msg =
          data.error === "PDF_NOT_ATTACHED"
            ? "Attach a PDF before sending."
            : data.error === "PATIENT_EMAIL_REQUIRED"
              ? "Add patient email before sending."
              : (data.error ?? `Send failed (${res.status})`);
        throw new Error(msg);
      }
      setActionMsg(data.patientMessage ?? "Sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  }

  async function fetchReportPdfBlob(id: string): Promise<Blob | null> {
    const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
      method: "PUT",
      credentials: "include",
    });
    if (!res.ok) return null;
    return res.blob();
  }

  async function downloadReport(id: string, reportTitle: string) {
    const blob = await fetchReportPdfBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportTitle.replace(/[^a-zA-Z0-9._-]+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function emailReport(id: string) {
    setEmailingId(id);
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const msg =
          data.error === "SMTP_NOT_CONFIGURED"
            ? "Email is not configured on the server. Ask admin to set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM."
            : data.error === "PDF_NOT_ATTACHED"
              ? "Attach a PDF before emailing."
              : data.error === "PATIENT_EMAIL_REQUIRED"
                ? "Add patient email before emailing."
                : data.error === "SEND_FAILED"
                  ? "Email failed to send. Try again in a moment."
                  : (data.error ?? `Email failed (${res.status})`);
        throw new Error(msg);
      }
      setActionMsg(data.message ?? "Email sent to patient.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email failed");
    } finally {
      setEmailingId(null);
    }
  }

  async function setReportArchived(id: string, archived: boolean, reportTitle: string) {
    setArchivingId(id);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Update failed (${res.status})`);
      if (qrReport?.id === id && archived) setQrReport(null);
      if (lastReportId === id && archived) setLastReportId(null);
      setActionMsg(
        archived
          ? `"${reportTitle}" archived. It stays in the patient app if already sent.`
          : `"${reportTitle}" restored to your active list.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setArchivingId(null);
    }
  }

  async function deleteReport(id: string, reportTitle: string) {
    if (
      !window.confirm(
        `Delete "${reportTitle}"? This removes the report and its PDF permanently.`
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      if (qrReport?.id === id) setQrReport(null);
      if (lastReportId === id) setLastReportId(null);
      setActionMsg("Report deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const tabClass = (tab: CreateTab) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
      createTab === tab
        ? "bg-[#242a5f] text-white shadow-sm"
        : "text-[#242a5f]/70 hover:bg-white/80"
    }`;

  const activeReports = reports.filter((r) => !r.archived);
  const archivedReports = reports.filter((r) => r.archived);
  const visibleReports = listView === "archived" ? archivedReports : activeReports;

  function renderReportRow(row: ClinicReportRow) {
    const badge = statusLabel(row);
    const highlight = row.id === lastReportId;
    return (
      <li
        key={row.id}
        className={`rounded-xl border bg-white/90 p-4 shadow-sm ${
          highlight ? "border-emerald-300 ring-2 ring-emerald-100" : "border-[#242a5f]/10"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#242a5f]">{row.title}</p>
            <p className="mt-0.5 text-sm text-zinc-600">
              {row.patientName ?? "Unnamed patient"}
              {row.patientEmail ? ` · ${row.patientEmail}` : " · No email yet"}
            </p>
            {!row.archived && !row.hasEmail ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PatientEmailSelect
                  patients={recentPatients}
                  value={patientPick[row.id] ?? ""}
                  onChange={(email) =>
                    setPatientPick((prev) => ({ ...prev, [row.id]: email }))
                  }
                  placeholder="Select patient"
                  className="min-w-[14rem] flex-1 rounded-lg border border-[#242a5f]/20 bg-white px-2.5 py-1.5 text-xs text-[#242a5f]"
                />
                <button
                  type="button"
                  disabled={!patientPick[row.id]?.trim() || updatingEmailId === row.id}
                  onClick={() => void assignPatientToReport(row.id)}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-900 disabled:opacity-40"
                >
                  {updatingEmailId === row.id ? "Saving…" : "Assign patient"}
                </button>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {row.archived ? "Archived" : badge.text}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  row.accountCreated
                    ? "bg-slate-100 text-slate-700"
                    : "bg-orange-50 text-orange-800"
                }`}
              >
                {row.accountCreated ? "Account exists" : "No account yet"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!row.archived && !row.hasPdf ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={attachingId === row.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void attachPdfToReport(row.id, f);
                    e.target.value = "";
                  }}
                />
                {attachingId === row.id ? "Attaching…" : "Attach PDF"}
              </label>
            ) : null}
            {!row.archived ? (
              <>
                <button
                  type="button"
                  disabled={!row.hasPdf || !row.hasEmail}
                  onClick={() => void sendReport(row.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#242a5f] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
                <button
                  type="button"
                  disabled={!row.hasPdf}
                  onClick={() => setPreviewReport(row)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  disabled={!row.hasPdf}
                  onClick={() => void downloadReport(row.id, row.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  disabled={!row.hasPdf || !row.hasEmail || emailingId === row.id}
                  onClick={() => void emailReport(row.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {emailingId === row.id ? "Sending…" : "Email"}
                </button>
                <button
                  type="button"
                  disabled={!row.hasPdf || !row.shareUrl}
                  onClick={() => setQrReport(row)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  QR
                </button>
                <button
                  type="button"
                  disabled={archivingId === row.id}
                  onClick={() => void setReportArchived(row.id, true, row.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {archivingId === row.id ? "Archiving…" : "Archive"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!row.hasPdf}
                  onClick={() => setPreviewReport(row)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </button>
                <button
                  type="button"
                  disabled={!row.hasPdf}
                  onClick={() => void downloadReport(row.id, row.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-2 text-xs font-medium text-[#242a5f] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  disabled={archivingId === row.id}
                  onClick={() => void setReportArchived(row.id, false, row.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 disabled:opacity-40"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  {archivingId === row.id ? "Restoring…" : "Unarchive"}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={deletingId === row.id}
              onClick={() => void deleteReport(row.id, row.title)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingId === row.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#242a5f]">Clinic reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Generate SkinFit PDFs, upload machine reports, and deliver to patients.
        </p>
      </div>

      <div className="rounded-2xl border border-white/40 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-[#242a5f]">Patient</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#242a5f]">Patient name *</span>
            <input
              type="text"
              required
              value={patientName}
              onChange={(e) => {
                const name = e.target.value;
                setPatientName(name);
                if (createTab === "generate") {
                  setOutputName(resolveOutputBasename(name, sourceFile?.name ?? null));
                }
              }}
              className="mt-1 w-full rounded-lg border border-[#242a5f]/20 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#242a5f]">Patient email</span>
            <PatientEmailSelect
              patients={recentPatients}
              value={patientEmail}
              onChange={(email, patient) => {
                setPatientEmail(email);
                if (patient?.name) setPatientName(patient.name);
              }}
              placeholder="Select patient (optional)"
              className="mt-1 w-full rounded-lg border border-[#242a5f]/20 bg-white px-3 py-2.5 text-sm text-[#242a5f]"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Recent patients, newest first. You can also assign from a saved report below.
            </p>
          </label>
        </div>

        <div className="mt-5 flex rounded-xl bg-[#F8F9FC] p-1">
          <button type="button" className={tabClass("generate")} onClick={() => setCreateTab("generate")}>
            <Sparkles className="h-4 w-4" />
            Generate SkinFit PDF
          </button>
          <button type="button" className={tabClass("upload")} onClick={() => setCreateTab("upload")}>
            <Upload className="h-4 w-4" />
            Upload PDF
          </button>
        </div>

        {createTab === "generate" ? (
          <div className="mt-5 space-y-4">
            <div
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-xl border border-dashed border-[#242a5f]/25 bg-[#F8F9FC] p-6 text-center transition hover:border-[#242a5f]/50 hover:bg-white"
              onClick={() => generatorInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  generatorInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) pickGeneratorFile(f, patientName, setSourceFile, setOutputName);
              }}
            >
              <input
                ref={generatorInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickGeneratorFile(f, patientName, setSourceFile, setOutputName);
                }}
              />
              <p className="text-sm text-zinc-700">
                {sourceFile ? sourceFile.name : "Drop machine PDF here or choose a file"}
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-[#242a5f]/20 bg-white px-4 py-2 text-sm font-medium text-[#242a5f] hover:bg-[#F8F9FC]"
                onClick={(e) => {
                  e.stopPropagation();
                  generatorInputRef.current?.click();
                }}
              >
                Choose PDF
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-[#242a5f]">Output filename</span>
              <div className="mt-1.5 flex overflow-hidden rounded-lg border border-[#242a5f]/20 bg-white focus-within:ring-2 focus-within:ring-[#242a5f]/20">
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="skinfit-report_Name"
                  disabled={!sourceFile}
                  className="min-w-0 flex-1 px-3 py-2.5 text-sm text-zinc-800 outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
                />
                <span className="flex items-center border-l border-[#242a5f]/15 bg-[#F8F9FC] px-3 text-sm text-zinc-500">
                  .pdf
                </span>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[#242a5f]">Event / occasion label</span>
              <input
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                placeholder="e.g. FLO Santé"
                className="mt-1.5 block w-full rounded-lg border border-[#242a5f]/20 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-[#242a5f]/20"
              />
            </label>

            <button
              type="button"
              disabled={!sourceFile || !patientName.trim() || generating}
              onClick={() => void handleGenerate()}
              className="w-full rounded-xl bg-[#242a5f] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate SkinFit PDF"}
            </button>

            {lastReportId && patientEmail.trim() ? (
              <button
                type="button"
                disabled={updatingEmail}
                onClick={() => void handleAddEmailToSaved()}
                className="w-full rounded-xl border border-[#242a5f]/25 bg-white px-4 py-3 text-sm font-semibold text-[#242a5f] disabled:opacity-50"
              >
                {updatingEmail ? "Updating…" : "Add email to saved report"}
              </button>
            ) : null}
          </div>
        ) : (
          <form onSubmit={(e) => void handleUpload(e)} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-[#242a5f]">Report title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#242a5f]/20 px-3 py-2.5 text-sm"
                placeholder="Skin analysis report"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[#242a5f]">PDF file</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Leave empty to save the patient before the scan, then attach PDF later.
              </p>
            </label>
            <button
              type="submit"
              disabled={uploading || !patientName.trim()}
              className="w-full rounded-xl bg-[#242a5f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploading
                ? "Saving…"
                : pdfFile
                  ? "Save report"
                  : "Save patient (before scan)"}
            </button>
          </form>
        )}
      </div>

      <div ref={savedListRef} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-[#242a5f]">
            {listView === "archived" ? "Archived reports" : "Saved reports"}
          </h2>
          <div className="flex rounded-lg border border-[#242a5f]/15 bg-white/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setListView("active")}
              className={`rounded-md px-2.5 py-1.5 ${
                listView === "active" ? "bg-[#242a5f] text-white" : "text-[#242a5f]/70"
              }`}
            >
              Active ({activeReports.length})
            </button>
            <button
              type="button"
              onClick={() => setListView("archived")}
              className={`rounded-md px-2.5 py-1.5 ${
                listView === "archived" ? "bg-[#242a5f] text-white" : "text-[#242a5f]/70"
              }`}
            >
              Archived ({archivedReports.length})
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#242a5f]/15 px-3 py-2 text-sm text-[#242a5f]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {actionMsg ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMsg}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visibleReports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-4 py-8 text-center text-sm text-zinc-500">
          {listView === "archived" ? "No archived reports." : "No reports yet."}
        </p>
      ) : (
        <ul className="space-y-3">{visibleReports.map((row) => renderReportRow(row))}</ul>
      )}

      {qrReport?.shareUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#242a5f]">Scan to download</h3>
            <p className="mt-1 text-sm text-zinc-600">{qrReport.title}</p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Download QR code" className="mx-auto mt-4" />
            ) : (
              <p className="mt-4 text-center text-sm text-zinc-500">Generating QR…</p>
            )}
            <p className="mt-3 break-all text-center text-xs text-zinc-500">{qrReport.shareUrl}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-zinc-200 py-2 text-sm"
              onClick={() => setQrReport(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {previewReport ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal
          aria-label="PDF preview"
          onClick={closePdfPreview}
        >
          <div
            className="flex h-[min(90vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[#242a5f]">
                  {previewReport.title}
                </h3>
                <p className="truncate text-sm text-zinc-600">
                  {previewReport.patientName ?? "Unnamed patient"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={!previewPdfUrl}
                  onClick={() => void downloadReport(previewReport.id, previewReport.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#242a5f]/20 px-3 py-1.5 text-xs font-medium text-[#242a5f] disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={closePdfPreview}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-zinc-100">
              {previewLoading || !previewPdfUrl ? (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Loading preview…
                </div>
              ) : (
                <iframe
                  title={`${previewReport.title} preview`}
                  src={previewPdfUrl}
                  className="h-full w-full border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
