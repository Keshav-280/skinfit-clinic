import Link from "next/link";
import { Building2, Lock, MessageCircle } from "lucide-react";

import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "@/src/lib/patientClinicVisitMessages";

type Props = {
  message?: string;
  variant?: "composer" | "inline" | "empty";
  supportHref?: string;
};

export function DoctorChatClinicVisitGate({
  message = DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
  variant = "composer",
  supportHref = "/dashboard/chat?assistant=support",
}: Props) {
  if (variant === "inline") {
    return (
      <div className="overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2D3E6B] to-[#243456] p-4 shadow-[0_10px_32px_rgba(45,62,107,0.22)]">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Lock className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Unlock after your clinic visit</p>
            <p className="mt-1 text-xs leading-relaxed text-white/80">{message}</p>
            <Link
              href={supportHref}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#A7F3D0] hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Contact Clinic Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2D3E6B] via-[#2C3E6B] to-[#243456] px-6 py-8 text-center shadow-[0_14px_44px_rgba(45,62,107,0.24)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Building2 className="h-7 w-7 text-white" aria-hidden />
          </div>
          <h3 className="mt-5 text-lg font-extrabold tracking-tight text-white">
            Doctor chat unlocks in clinic
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{message}</p>
          <Link
            href={supportHref}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-[14px] bg-white px-5 py-3 text-sm font-bold text-[#2D3E6B] shadow-md transition hover:bg-[#F2F9F2]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Contact Clinic Support
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#2D3E6B]/15 bg-gradient-to-br from-[#2D3E6B] to-[#243456] px-5 py-6 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
          <Lock className="h-6 w-6 text-white" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-extrabold text-white sm:text-lg">
          Unlock after your clinic visit
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{message}</p>
        <Link
          href={supportHref}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-[14px] bg-white px-5 py-2.5 text-sm font-bold text-[#2D3E6B] shadow-md transition hover:bg-[#F2F9F2]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Contact Clinic Support
        </Link>
      </div>
    </div>
  );
}
