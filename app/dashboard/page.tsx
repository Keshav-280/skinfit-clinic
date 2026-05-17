import React from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "../../src/lib/auth/get-session";
import { PatientDashboardDesktop } from "../../components/dashboard/PatientDashboardDesktop";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  return <PatientDashboardDesktop />;
}
