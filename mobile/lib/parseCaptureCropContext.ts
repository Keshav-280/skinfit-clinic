/** Matches server `CaptureCropContext` — sent with scan upload for ML crop math. */
export type CaptureCropContext = {
  source: "mobile" | "web";
  viewfinderW?: number;
  viewfinderH?: number;
};

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
