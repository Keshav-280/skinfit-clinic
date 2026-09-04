import { redirect } from "next/navigation";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export default async function ClinicIndexPage() {
  const id = await getDoctorPortalUserId();
  if (id) redirect("/clinic/requests");
  redirect("/clinic/login");
}
