import { redirect } from "next/navigation";

/** Merged into Clinic reports - keep URL working for bookmarks. */
export default function SkinfitReportGeneratorRedirect() {
  redirect("/doctor/clinic-reports?tab=generate");
}
