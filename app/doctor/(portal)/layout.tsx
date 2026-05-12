import Link from "next/link";
import { redirect } from "next/navigation";
import { Stethoscope, UserRound, Users } from "lucide-react";
import { DoctorLogoutButton } from "@/components/doctor/DoctorLogoutButton";
import { DoctorAppointmentsBell } from "@/components/doctor/DoctorAppointmentsBell";
import { DoctorPatientChatBell } from "@/components/doctor/DoctorPatientChatBell";
import { DoctorSosBell } from "@/components/doctor/DoctorSosBell";
import { GlobalRefreshButton } from "@/components/ui/GlobalRefreshButton";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export default async function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const id = await getDoctorPortalUserId();
  if (!id) {
    redirect("/doctor/login");
  }

  return (
    <div className="flex min-h-screen bg-[#F4F6F3]">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-[220px] flex-col border-r border-slate-200/80 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C3E6B]">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-slate-900">SkinFit Clinic</span>
        </div>

        <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
          <Link
            href="/doctor/patients"
            className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <Users className="h-[18px] w-[18px] text-slate-400 group-hover:text-[#2C3E6B]" />
            Patients
          </Link>
          <Link
            href="/doctor/profile"
            className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <UserRound className="h-[18px] w-[18px] text-slate-400 group-hover:text-[#2C3E6B]" />
            Profile
          </Link>
        </nav>

        <div className="border-t border-slate-100 px-3 py-3">
          <DoctorLogoutButton />
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-5 py-3 backdrop-blur-md">
          {/* Mobile logo */}
          <Link href="/doctor/patients" className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2C3E6B]">
              <Stethoscope className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">SkinFit</span>
          </Link>

          {/* Mobile nav links */}
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/doctor/patients" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <Users className="h-4 w-4" />
            </Link>
            <Link href="/doctor/profile" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <UserRound className="h-4 w-4" />
            </Link>
          </div>

          {/* Spacer for desktop */}
          <div className="hidden md:block" />

          {/* Bells + actions */}
          <div className="flex items-center gap-1.5">
            <DoctorAppointmentsBell />
            <DoctorPatientChatBell />
            <DoctorSosBell />
            <GlobalRefreshButton compact />
            <div className="md:hidden">
              <DoctorLogoutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
