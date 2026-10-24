import { redirect } from "next/navigation";

const KEEP = ["src", "utm_source", "campaign", "utm_campaign", "ref"];

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const out = new URLSearchParams();
  for (const key of KEEP) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string" && first) out.set(key, first);
  }
  const qs = out.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}
