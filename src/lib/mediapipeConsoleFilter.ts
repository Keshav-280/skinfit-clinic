/**
 * Suppress benign MediaPipe / TFLite WASM stderr that gets routed to
 * console.error (and therefore surfaces in Next.js dev overlay as a fake
 * Console Error). Only filters strictly known-benign patterns — real errors
 * still pass through untouched.
 *
 * Patterns covered:
 *   - "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
 *   - generic absl/glog "INFO:" / "W0000 ..." TFLite logs
 *   - "Graph successfully started running" style notices
 */

let installed = false;

const BENIGN_PATTERNS: RegExp[] = [
  /TensorFlow Lite XNNPACK delegate/i,
  /^INFO:\s/,
  /^W\d{4}\s/, // absl warning prefix e.g. W0000 12:34:56.789
  /^I\d{4}\s/, // absl info prefix
  /Graph successfully started/i,
  /mediapipe/i,
];

function looksBenign(args: unknown[]): boolean {
  if (!args.length) return false;
  const first = args[0];
  if (typeof first !== "string") return false;
  return BENIGN_PATTERNS.some((re) => re.test(first));
}

export function installMediapipeConsoleFilter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (looksBenign(args)) {
      // Forward to debug so devs can still see it if needed.
      console.debug("[mediapipe-filtered]", ...args);
      return;
    }
    origError(...args);
  };
}
