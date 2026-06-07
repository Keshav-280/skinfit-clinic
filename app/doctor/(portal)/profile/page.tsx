"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import {
  doctorBtnPrimaryClass,
  doctorFormInputClass,
  doctorIvoryCardClass,
  doctorPatientPageGhostBtnClass,
  doctorProfileFieldClass,
  doctorProfileFieldReadOnlyClass,
  doctorProfileHintClass,
  doctorProfileLabelClass,
} from "@/src/lib/doctorPortalTheme";

type DoctorProfile = {
  id: string;
  name: string;
  email: string;
  specialty: string;
  imageUrl: string;
};

export default function DoctorProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/profile", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        profile?: DoctorProfile;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        setError(data.error || "Could not load profile.");
        return;
      }
      setProfile(data.profile);
      setName(data.profile.name || "");
      setSpecialty(data.profile.specialty || "");
      setImageUrl(data.profile.imageUrl || "");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const SIZE = 300;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
      const dataUri = canvas.toDataURL("image/jpeg", 0.75);
      setImageUrl(dataUri);
    };
    img.src = objectUrl;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          specialty: specialty.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save profile.");
        return;
      }
      setMessage("Profile updated.");
      void load();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal() {
    setDeleteCode("");
    setDeleteError(null);
    setDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteCode("");
    setDeleteError(null);
  }

  async function confirmDeleteAccount() {
    if (!deleteCode.trim()) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/doctor/profile/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ securityCode: deleteCode.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 403 || data.error === "INVALID_SECURITY_CODE") {
          setDeleteError("Incorrect security code.");
        } else if (res.status === 503) {
          setDeleteError(
            "Account deletion is not configured on this server (DOCTOR_PORTAL_SECURITY_CODE)."
          );
        } else {
          setDeleteError(data.error ?? "Could not delete your account.");
        }
        return;
      }
      setDeleteOpen(false);
      router.push("/doctor/login");
      router.refresh();
    } catch {
      setDeleteError("Could not delete your account.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-xl font-bold text-[#2C3E6B]">Doctor Profile</h1>
      <p className="mt-0.5 text-sm text-[#2C3E6B]/60">
        Manage your display name, specialty, and avatar for patient-facing chat.
      </p>

      <form onSubmit={onSave} className={`mt-5 p-6 ${doctorIvoryCardClass}`}>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[120px_1fr] sm:items-start">
          <label
            className="relative block h-[120px] w-[120px] cursor-pointer overflow-hidden rounded-2xl bg-white/95 shadow-[0_2px_8px_rgba(72,64,48,0.08),0_4px_14px_rgba(72,64,48,0.06)] transition hover:shadow-[0_4px_16px_rgba(72,64,48,0.12)]"
            title="Click to change photo"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Doctor avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl text-slate-300">
                📷
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white opacity-0 transition hover:opacity-100">
              Change
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
              disabled={loading || saving}
            />
          </label>
          <div className="space-y-4">
            <div>
              <label className={doctorProfileLabelClass}>Display name</label>
              <input
                className={doctorProfileFieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Rhea Sharma"
                disabled={loading || saving}
              />
            </div>
            <div>
              <label className={doctorProfileLabelClass}>Specialty</label>
              <input
                className={doctorProfileFieldClass}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Dermatology"
                disabled={loading || saving}
              />
            </div>
            <p className={doctorProfileHintClass}>
              Click the photo to change it. Square images work best.
            </p>
            <div>
              <label className={doctorProfileLabelClass}>Email</label>
              <input
                className={doctorProfileFieldReadOnlyClass}
                value={profile?.email || ""}
                readOnly
                aria-readonly
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading || saving}
            className={`${doctorBtnPrimaryClass} px-5 py-3 font-bold disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <section className={`mt-6 p-6 ${doctorIvoryCardClass}`}>
        <h2 className="text-sm font-bold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-[#2C3E6B]/65">
          Permanently delete your doctor portal account, profile photo, slots, and patient
          care links. Patient records stay in the system.
        </p>
        <button
          type="button"
          onClick={openDeleteModal}
          disabled={loading || saving}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete my account
        </button>
      </section>

      {deleteOpen ? (
        <>
          <button
            type="button"
            aria-label="Close delete account dialog"
            className="fixed inset-0 z-[2147483640] bg-slate-900/40"
            onClick={closeDeleteModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-doctor-account-title"
            className="fixed left-1/2 top-1/2 z-[2147483641] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl ring-1 ring-slate-900/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="delete-doctor-account-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Delete your account
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  This permanently removes your doctor profile and cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteBusy}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Security code
              </span>
              <input
                type="password"
                autoComplete="off"
                value={deleteCode}
                onChange={(e) => {
                  setDeleteCode(e.target.value);
                  if (deleteError) setDeleteError(null);
                }}
                placeholder="Enter security code"
                disabled={deleteBusy}
                className={`${doctorFormInputClass} mt-1.5`}
              />
            </label>
            {deleteError ? (
              <p className="mt-2 text-sm font-medium text-red-600" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteBusy}
                className={doctorPatientPageGhostBtnClass}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAccount()}
                disabled={deleteBusy || !deleteCode.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {deleteBusy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
