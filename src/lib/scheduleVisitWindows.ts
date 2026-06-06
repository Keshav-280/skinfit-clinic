export type VisitWindowId = "morning" | "afternoon" | "evening";

export const VISIT_WINDOW_OPTIONS: { id: VisitWindowId; label: string }[] = [
  { id: "morning", label: "Morning (9 am to 1 pm)" },
  { id: "afternoon", label: "Afternoon (1–5 pm)" },
  { id: "evening", label: "Evening (5 to 9 pm)" },
];

export function visitWindowsToTimePreferences(windows: VisitWindowId[]): string {
  return VISIT_WINDOW_OPTIONS.filter((w) => windows.includes(w.id))
    .map((w) => w.label)
    .join(", ");
}
