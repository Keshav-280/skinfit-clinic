"use client";

import QRCode from "qrcode";
import { Download, Mail, QrCode, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ClinicReportRow = {
  id: string;
  patientEmail: string;
  patientName: string | null;
  title: string;
  status: "draft" | "pending_account" | "sent";
  hasPdf: boolean;
  accountCreated: boolean;
  sentAt: string | null;
  createdAt: string;
  shareUrl: string | null;
  kind: "external_clinic_report";
};

function statusLabel(row: ClinicReportRow): { text: string; className: string } {
  if (row.status === "draft" && !row.hasPdf) {
    return {
      text: "Awaiting PDF",
      className: "bg-sky-50 text-sky-800 border border-sky-200",
    };
  }
  if (row.status === "draft") {
    return { text: "Draft", className: "bg-zinc-100 text-zinc-700" };
  }
  if (row.status === "pending_account") {
    return {
      text: "Sent — account not created",
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

export function DoctorClinicReportsClient() {
  const [reports, setReports] = useState<ClinicReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [patientEmail, setPatientEmail] = useState("");
  const [patientName, setPatientName] = useState("");
  const [title, setTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [qrReport, setQrReport] = useState<ClinicReportRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/clinic-reports", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { reports?: ClinicReportRow[] };
      setReports(data.reports ?? []);
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

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!patientEmail.trim()) return;
    setUploading(true);
    setError(null);
    setActionMsg(null);
    try {
      const form = new FormData();
      if (pdfFile) form.append("file", pdfFile);
      form.append("patientEmail", patientEmail.trim());
      if (patientName.trim()) form.append("patientName", patientName.trim());
      if (title.trim()) form.append("title", title.trim());
      const res = await fetch("/api/doctor/clinic-reports", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        report?: ClinicReportRow;
      };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setPdfFile(null);
      setTitle("");
      setActionMsg(
        pdfFile
          ? "Report saved as draft. Tap Send to deliver to the patient."
          : "Patient email saved. Attach the PDF after the scan, then Send."
      );
      if (!pdfFile) {
        setPatientEmail("");
        setPatientName("");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  async function attachPdfToReport(reportId: string, file: File) {
    setAttachingId(reportId);
    setError(null);
    setActionMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("patientEmail", "attach@placeholder.local");
      form.append("attachToId", reportId);
      const row = reports.find((r) => r.id === reportId);
      if (row?.patientEmail) form.set("patientEmail", row.patientEmail);
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
            : (data.error ?? `Send failed (${res.status})`);
        throw new Error(msg);
      }
      setActionMsg(data.patientMessage ?? "Sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  }

  async function downloadReport(id: string, reportTitle: string) {
    const res = await fetch(`/api/doctor/clinic-reports/${id}`, {
      method: "PUT",
      credentials: "include",
    });
    if (!res.ok) return;
    const blob = await res.blob();
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

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#242a5f]">Clinic reports</h1>
      </div>

      <form
        onSubmit={(e) => void handleUpload(e)}
        className="rounded-2xl border border-white/40 bg-white/80 p-6 shadow-sm backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold text-[#242a5f]">Save new report</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="text-sm font-medium text-[#242a5f]">Patient email *</span>
            <input
              type="email"
              required
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#242a5f]/20 px-3 py-2.5 text-sm"
              placeholder="patient@email.com"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="text-sm font-medium text-[#242a5f]">Patient name</span>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#242a5f]/20 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[#242a5f]">Report title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#242a5f]/20 px-3 py-2.5 text-sm"
              placeholder="Skin analysis report"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-[#242a5f]">PDF file</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={uploading || !patientEmail.trim()}
          className="mt-5 rounded-xl bg-[#242a5f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading
            ? "Saving…"
            : pdfFile
              ? "Save draft with PDF"
              : "Save patient email (before scan)"}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#242a5f]">Saved reports</h2>
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
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 bg-white/60 px-4 py-8 text-center text-sm text-zinc-500">
          No reports yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((row) => {
            const badge = statusLabel(row);
            return (
              <li
                key={row.id}
                className="rounded-xl border border-[#242a5f]/10 bg-white/90 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#242a5f]">{row.title}</p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      {row.patientName ? `${row.patientName} · ` : ""}
                      {row.patientEmail}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.text}
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
                    {!row.hasPdf ? (
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
                    <button
                      type="button"
                      disabled={!row.hasPdf}
                      onClick={() => void sendReport(row.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#242a5f] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
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
                      disabled={!row.hasPdf || emailingId === row.id}
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
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}
