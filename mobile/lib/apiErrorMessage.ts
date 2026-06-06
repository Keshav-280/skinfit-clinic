export function apiErrorMessage(
  data: Record<string, unknown>,
  status: number,
  fallback: string
): string {
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (status === 404) {
    return "Password reset is not available on the server yet. Deploy the latest backend, then try again.";
  }
  if (typeof data.error === "string") {
    return data.error.replace(/_/g, " ");
  }
  if (status >= 500) {
    return `Server error (${status}). Try again shortly.`;
  }
  return fallback;
}
