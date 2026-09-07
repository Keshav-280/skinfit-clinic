import { redirect } from "next/navigation";
import { getDoctorPortalUserId } from "@/src/lib/auth/doctor-access";

export default async function OpsIndexPage() {
  const id = await getDoctorPortalUserId();
  if (id) redirect("/ops/overview");
  redirect("/ops/login");
}
