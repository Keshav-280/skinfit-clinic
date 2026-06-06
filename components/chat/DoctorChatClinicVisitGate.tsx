import Link from "next/link";
import { Building2, Lock, MessageCircle } from "lucide-react";

import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "@/src/lib/patientClinicVisitMessages";

type Props = {
  message?: string;
  variant?: "composer" | "inline" | "empty";
  supportHref?: string;
  onSupportPress?: () => void;
};

function SupportCta({
  supportHref,
  onSupportPress,
  className,
}: {
  supportHref: string;
  onSupportPress?: () => void;
  className: string;
}) {
  const content = (
    <>
      <MessageCircle className="h-4 w-4" aria-hidden />
      Contact Clinic Support
    </>
  );

  if (onSupportPress) {
    return (
      <button type="button" onClick={onSupportPress} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={supportHref} className={className}>
      {content}
    </Link>
  );
}

export function DoctorChatClinicVisitGate({
  message = DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE,
  variant = "composer",
  supportHref = "/dashboard/chat?assistant=support",
  onSupportPress,
}: Props) {
  const ctaClass =
    variant === "inline"
      ? "mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#2D3E6B] hover:text-[#243456]"
      : "mt-5 inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#2D3E6B] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#243456]";
  if (variant === "inline") {
    return (
      <div className="overflow-hidden rounded-[18px] border border-[#E5E7EB] bg-white/85 p-4 shadow-3d-white">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2D3E6B]/10 text-[#2D3E6B]">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#2D3E6B]">Unlock after your clinic visit</p>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{message}</p>
            <SupportCta
              supportHref={supportHref}
              onSupportPress={onSupportPress}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#2D3E6B] hover:text-[#243456]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white px-6 py-8 text-center shadow-3d-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D3E6B]/10 text-[#2D3E6B]">
            <Building2 className="h-7 w-7" aria-hidden />
          </div>
          <h3 className="mt-5 text-lg font-extrabold tracking-tight text-[#2D3E6B]">
            Doctor chat unlocks in clinic
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{message}</p>
          <SupportCta
            supportHref={supportHref}
            onSupportPress={onSupportPress}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#2D3E6B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#243456]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#2D3E6B]/10 bg-white/90 px-5 py-6 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D3E6B]/10 text-[#2D3E6B]">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-extrabold text-[#2D3E6B] sm:text-lg">
          Unlock after your clinic visit
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{message}</p>
        <SupportCta
          supportHref={supportHref}
          onSupportPress={onSupportPress}
          className={ctaClass}
        />
      </div>
    </div>
  );
}
