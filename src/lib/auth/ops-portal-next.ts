import { clinicPortalLoginUrl } from "@/src/lib/auth/clinic-portal-next";

export const OPS_IN_CLINIC_PATH = "/clinic/ops";

/** Ops now lives under the clinic site. Old /ops paths map here. */
export function sanitizeOpsPortalNext(
  _next?: string | null | undefined
): string {
  return OPS_IN_CLINIC_PATH;
}

export function opsPortalLoginUrl(origin: string, _returnPath?: string): URL {
  return clinicPortalLoginUrl(origin, OPS_IN_CLINIC_PATH);
}
