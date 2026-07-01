import { redirect } from "next/navigation";

/** Legacy path — report generator lives under the doctor portal. */
export default function SkinfitReportGeneratorRedirect() {
  redirect("/doctor/clinic-reports?tab=generate");
}
