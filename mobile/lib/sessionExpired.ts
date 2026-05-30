/** Called once when any API returns 401 — AuthProvider wires this to signOut. */
let handler: (() => void | Promise<void>) | null = null;
let inflight: Promise<void> | null = null;

export function setSessionExpiredHandler(fn: (() => void | Promise<void>) | null) {
  handler = fn;
}

export function notifySessionExpired() {
  if (!handler || inflight) return;
  inflight = Promise.resolve(handler()).finally(() => {
    inflight = null;
  });
}
