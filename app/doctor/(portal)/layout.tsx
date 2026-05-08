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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/doctor/patients" className="flex items-center gap-2 font-semibold text-slate-900">
            <Stethoscope className="h-5 w-5 text-teal-600" />
            SkinnFit clinic
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link
              href="/doctor/patients"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <Users className="h-4 w-4" />
              Patients
            </Link>
            <Link
              href="/doctor/profile"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              <UserRound className="h-4 w-4" />
              Profile
            </Link>
            <DoctorAppointmentsBell />
            <DoctorPatientChatBell />
            <DoctorSosBell />
            <GlobalRefreshButton compact />
            <DoctorLogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
