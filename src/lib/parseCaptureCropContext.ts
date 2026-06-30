import type { CaptureCropContext } from "@/src/lib/cropScanImageForMl";
import type { WebFormData } from "@/src/lib/webRequestFormData";

export function parseCaptureCropContext(
  formData: WebFormData
): CaptureCropContext | undefined {
  const sourceRaw = formData.get("captureSource");
  const vfRaw = formData.get("captureViewfinder");
  let viewfinderW: number | undefined;
  let viewfinderH: number | undefined;

  if (typeof vfRaw === "string" && vfRaw.trim()) {
    try {
      const parsed = JSON.parse(vfRaw) as { width?: number; height?: number };
      const w = Number(parsed.width);
      const h = Number(parsed.height);
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        viewfinderW = w;
        viewfinderH = h;
      }
    } catch {
      /* ignore */
    }
  }

  const hasViewfinder =
    viewfinderW != null && viewfinderH != null && viewfinderW > 0 && viewfinderH > 0;

  const source =
    sourceRaw === "mobile" || (sourceRaw === "mobile-web-handoff" && hasViewfinder)
      ? "mobile"
      : sourceRaw === "web" || sourceRaw === "mobile-web-handoff"
        ? "web"
        : undefined;

  if (hasViewfinder && viewfinderW != null && viewfinderH != null) {
    return {
      source: source ?? "mobile",
      viewfinderW,
      viewfinderH,
    };
  }

  if (source === "web") return { source: "web" };
  return undefined;
}

export function appendCaptureCropContext(
  form: FormData,
  ctx: CaptureCropContext
): void {
  form.append("captureSource", ctx.source);
  if (ctx.viewfinderW && ctx.viewfinderH) {
    form.append(
      "captureViewfinder",
      JSON.stringify({ width: ctx.viewfinderW, height: ctx.viewfinderH })
    );
  }
}
