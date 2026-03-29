import { addDays, addMonths, format, startOfMonth } from "date-fns";

/** Default rows for `priority_reminders` (schedules page). */
export const DEFAULT_PRIORITY_REMINDERS = [
  { sortOrder: 1, title: "Complete AM Routine", priority: "high" as const },
  {
    sortOrder: 2,
    title: "Upload Weekly Progress Photo",
    priority: "high" as const,
  },
  { sortOrder: 3, title: "Complete PM Routine", priority: "medium" as const },
  {
    sortOrder: 4,
    title: "Apply retinol serum (PM)",
    priority: "medium" as const,
  },
] as const;

/**
 * Sample calendar events anchored to `ref` (defaults to today) so month/week
 * views always show relevant dates after seed or first-time schedules setup.
 */
export function getDefaultScheduleEvents(ref: Date = new Date()) {
  const thisMonth = startOfMonth(ref);
  const nextMonth = startOfMonth(addMonths(ref, 1));
  const rows = [
    { base: thisMonth, add: 3, title: "Consultation with Dr. Ruby", hm: "10:00" },
    {
      base: thisMonth,
      add: 10,
      title: "Session 2: Laser treatment",
      hm: "14:30",
    },
    { base: thisMonth, add: 17, title: "Follow-up check-in", hm: "11:15" },
    { base: thisMonth, add: 24, title: "Home care product pickup", hm: "16:00" },
    { base: nextMonth, add: 7, title: "Monthly progress review", hm: "09:30" },
    {
      base: nextMonth,
      add: 21,
      title: "Hydration facial session",
      hm: "15:45",
    },
  ] as const;
  return rows.map(({ base, add, title, hm }) => ({
    ymd: format(addDays(base, add), "yyyy-MM-dd"),
    title,
    timeHm: hm,
  }));
}
