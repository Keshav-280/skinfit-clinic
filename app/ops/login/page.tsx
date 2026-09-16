import { redirect } from "next/navigation";

export default function OpsLoginPage() {
  redirect("/clinic/login?next=/clinic/ops");
}
