import { Ionicons } from "@expo/vector-icons";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfWeek,
  format,
  getDate,
  isSameDay,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { getApiBase } from "@/lib/apiBase";
import {
  buildCalendarCells,
  CAL_DAYS,
  compareScheduleEvents,
  eventsInMonth,
  eventsInWeek,
  formatEventTimeChip,
  formatScheduleWhen,
  getCellEvents,
  localYmd,
  parseLocalYmd,
  type ScheduleEventRow,
  WEEK_OPTS,
} from "@/lib/schedulesCalendar";

type PendingScheduleRequestRow = {
  id: string;
  preferredDateYmd: string;
  issue?: string;
  daysAffected?: number | null;
  timePreferences: string;
  attachmentsCount?: number;
  status: string;
  cancelledReason?: string | null;
};

function pendingToSyntheticEvents(pending: PendingScheduleRequestRow[]): ScheduleEventRow[] {
  return pending.map((r) => ({
    id: `req:${r.id}`,
    eventDateYmd: r.preferredDateYmd,
    eventTimeHm: null,
    title: `Visit request (pending) — ${(r.issue?.trim() || "Skin concern")}: ${r.timePreferences.slice(0, 72)}${
      r.timePreferences.length > 72 ? "…" : ""
    }`,
    completed: false,
    attachmentsCount: r.attachmentsCount ?? 0,
  }));
}

function closedToSynthetic(closed: PendingScheduleRequestRow[]): ScheduleEventRow[] {
  return closed.map((r) => {
    const declined = String(r.status || "").toLowerCase() === "declined";
    const label = declined ? "Declined request" : "Cancelled";
    const reason = r.cancelledReason?.trim() || null;
    return {
      id: `reqclosed:${r.id}`,
      eventDateYmd: r.preferredDateYmd,
      eventTimeHm: null,
      title: `${label} — ${(r.issue?.trim() || "Skin concern")}: ${r.timePreferences.slice(0, 72)}${
        r.timePreferences.length > 72 ? "…" : ""
      }`,
      completed: false,
      cancelled: true,
      cancellationReason: reason,
    };
  });
}

function chunkWeeks<T>(cells: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

export default function SchedulesScreen() {
  const { token } = useAuth();
  const [scheduleTab, setScheduleTab] = useState<"treatment" | "appointments">("appointments");
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [treatmentEvents, setTreatmentEvents] = useState<ScheduleEventRow[]>([]);
  const [appointmentEvents, setAppointmentEvents] = useState<ScheduleEventRow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingScheduleRequestRow[]>([]);
  const [closedRequests, setClosedRequests] = useState<PendingScheduleRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarRefreshing, setCalendarRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visitRequestOpen, setVisitRequestOpen] = useState(false);
  const [visitRequestYmd, setVisitRequestYmd] = useState<string | null>(null);
  const [visitIssue, setVisitIssue] = useState("Skin concern");
  const [visitDaysAffected, setVisitDaysAffected] = useState("");
  const [visitTimes, setVisitTimes] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [visitWindow, setVisitWindow] = useState<"morning" | "afternoon" | "evening">("morning");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [visitBusy, setVisitBusy] = useState(false);

  const calendarCells = useMemo(
    () => buildCalendarCells(currentDate, view),
    [currentDate, view]
  );

  const appointmentCalendarEvents = useMemo(() => {
    const cancelledApptDates = new Set(
      appointmentEvents
        .filter((e) => e.cancelled)
        .map((e) => e.eventDateYmd)
    );
    const filteredClosed = closedRequests.filter(
      (r) => !cancelledApptDates.has(r.preferredDateYmd)
    );
    return [
      ...appointmentEvents,
      ...pendingToSyntheticEvents(pendingRequests),
      ...closedToSynthetic(filteredClosed),
    ].sort(compareScheduleEvents);
  }, [appointmentEvents, pendingRequests, closedRequests]);

  const activeCalendarEvents: ScheduleEventRow[] = useMemo(() => {
    if (scheduleTab === "treatment") return treatmentEvents;
    if (scheduleTab === "appointments") return appointmentCalendarEvents;
    return [];
  }, [scheduleTab, treatmentEvents, appointmentCalendarEvents]);

  const headerLabel =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, WEEK_OPTS), "MMM d")} – ${format(endOfWeek(currentDate, WEEK_OPTS), "MMM d, yyyy")}`;

  const loadBootstrap = useCallback(async () => {
    if (!token) return;
    const json = await apiJson<{
      initialScheduleEvents?: ScheduleEventRow[];
      initialTreatmentEvents?: ScheduleEventRow[];
      initialAppointmentEvents?: ScheduleEventRow[];
      pendingScheduleRequests?: PendingScheduleRequestRow[];
      closedScheduleRequests?: PendingScheduleRequestRow[];
    }>("/api/patient/schedules", token, { method: "GET" });
    setTreatmentEvents(json.initialTreatmentEvents ?? []);
    setAppointmentEvents(json.initialAppointmentEvents ?? []);
    setPendingRequests(json.pendingScheduleRequests ?? []);
    setClosedRequests(json.closedScheduleRequests ?? []);
  }, [token]);

  const loadAll = useCallback(async () => {
    setError(null);
    await loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await loadAll();
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load schedules.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadAll]);

  const listEventsCal = useMemo(
    () =>
      view === "month"
        ? eventsInMonth(activeCalendarEvents, currentDate)
        : eventsInWeek(activeCalendarEvents, currentDate),
    [view, activeCalendarEvents, currentDate]
  );
  const featuredUpcoming = useMemo(
    () =>
      appointmentCalendarEvents.find(
        (e) => !e.completed && !e.cancelled && !String(e.id).startsWith("req:")
      ) ?? null,
    [appointmentCalendarEvents]
  );

  const handlePrev = () =>
    view === "month"
      ? setCurrentDate((d) => subMonths(d, 1))
      : setCurrentDate((d) => subWeeks(d, 1));

  const handleNext = () =>
    view === "month"
      ? setCurrentDate((d) => addMonths(d, 1))
      : setCurrentDate((d) => addWeeks(d, 1));

  async function refreshCalendar() {
    setCalendarRefreshing(true);
    try {
      await loadBootstrap();
    } finally {
      setCalendarRefreshing(false);
    }
  }

  async function submitVisitRequest() {
    if (!token || !visitRequestYmd) return;
    const issue = (visitIssue.trim() || "Appointment request").trim();
    if (issue.length < 2) {
      Alert.alert("Request", "Please describe your issue.");
      return;
    }
    const notes = visitNotes.trim();
    const tRaw = (visitTimes.trim() || selectedSlots.join(", ")).trim();
    const t = notes ? `${tRaw}${tRaw ? " | " : ""}Notes: ${notes}` : tRaw;
    if (t.length < 2) {
      Alert.alert("Request", "Add your preferred times or availability.");
      return;
    }
    const daysAffectedNum = visitDaysAffected.trim()
      ? Math.max(0, Math.min(3650, Number.parseInt(visitDaysAffected.trim(), 10) || 0))
      : null;
    setVisitBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/patient/schedule-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferredDateYmd: visitRequestYmd,
          issue,
          daysAffected: daysAffectedNum,
          timePreferences: t,
          attachments: [],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Request failed.");
      }
      setVisitRequestOpen(false);
      setVisitRequestYmd(null);
      setVisitIssue("Skin concern");
      setVisitDaysAffected("");
      setVisitTimes("");
      setVisitNotes("");
      setVisitWindow("morning");
      setSelectedSlots([]);
      await loadBootstrap();
    } catch (e) {
      Alert.alert("Request", e instanceof Error ? e.message : "Failed.");
    } finally {
      setVisitBusy(false);
    }
  }

  const slotOptions: Record<"morning" | "afternoon" | "evening", string[]> = {
    morning: ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"],
    afternoon: ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM"],
    evening: ["4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM"],
  };

  function toggleSlot(slot: string) {
    setSelectedSlots((prev) => {
      const next = prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot];
      setVisitTimes(next.join(", "));
      return next;
    });
  }

  const [reqCalMonth, setReqCalMonth] = useState(() => new Date());

  const reqCalCells = useMemo(() => {
    const year = reqCalMonth.getFullYear();
    const month = reqCalMonth.getMonth();
    const first = new Date(year, month, 1);
    const weekStart = startOfWeek(first, WEEK_OPTS);
    const cells: (Date | null)[] = [];
    let cursor = weekStart;
    for (let i = 0; i < 42; i++) {
      cells.push(cursor.getMonth() === month ? cursor : null);
      cursor = addDays(cursor, 1);
    }
    while (cells.length > 35 && cells.slice(-7).every((c) => c === null)) {
      cells.splice(-7, 7);
    }
    return cells;
  }, [reqCalMonth]);

  const cellMinH = view === "week" ? 128 : 72;

  function renderCalendarGrid() {
    const weeks = chunkWeeks(calendarCells);
    const now = new Date();

    function renderCell(day: Date | null, idx: number, colIndex: number) {
      const cellYmd = day ? localYmd(day) : null;
      const cellEvents = day ? getCellEvents(day, activeCalendarEvents) : [];
      const hasContent = cellEvents.length > 0;
      const isToday = day ? isSameDay(day, now) : false;

      const dayBody =
        day !== null ? (
          <>
            <View style={[styles.dayNumWrap, isToday && styles.dayNumWrapToday]}>
              <Text
                style={[
                  styles.cellDayNum,
                  hasContent && styles.cellDayNumHi,
                  isToday && styles.cellDayNumToday,
                ]}
              >
                {getDate(day)}
              </Text>
            </View>
            {scheduleTab === "appointments" ? (
              <View style={styles.appointmentDotsRow}>
                {cellEvents
                  .slice(0, 2)
                  .map((event) => {
                    const isPending = event.id.startsWith("req:");
                    const isCancelled = event.cancelled === true;
                    const isDone = event.completed;
                    const isGuideline =
                      event.eventKind === "pre_treatment" ||
                      event.eventKind === "post_treatment" ||
                      /guideline/i.test(event.title);
                    let color = "#2B3A67";
                    if (isCancelled) color = "#dc2626";
                    else if (isDone) color = "#16a34a";
                    else if (isPending) color = "#d97706";
                    else if (isGuideline) color = "#7c3aed";
                    return <View key={event.id} style={[styles.eventDot, { backgroundColor: color }]} />;
                  })}
              </View>
            ) : (
              cellEvents.map((event) => {
                  const timeLabel = formatEventTimeChip(
                    event.eventTimeHm,
                    event.eventSlotEndTimeHm
                  );
                  const pending = event.id.startsWith("req:");
                  const cancelled = event.cancelled === true;
                  const done = event.completed;

                  if (scheduleTab === "treatment") {
                    const isPre = event.eventKind === "pre_treatment";
                    const isPost = event.eventKind === "post_treatment";
                    const kindChipStyle = done
                      ? styles.eventChipDone
                      : isPre
                        ? styles.eventChipPre
                        : isPost
                          ? styles.eventChipPost
                          : styles.eventChipOpen;
                    const kindTimeStyle = done
                      ? styles.eventChipTimeDone
                      : isPre
                        ? styles.eventChipTimePre
                        : isPost
                          ? styles.eventChipTimePost
                          : styles.eventChipTimeOpen;
                    const kindTitleStyle = done
                      ? styles.eventChipTitleDone
                      : isPre
                        ? styles.eventChipTitlePre
                        : isPost
                          ? styles.eventChipTitlePost
                          : styles.eventChipTitleOpen;
                    return (
                      <View
                        key={event.id}
                        style={[styles.eventChip, kindChipStyle]}
                      >
                        {(isPre || isPost) ? (
                          <Text style={[styles.eventKindBadge, isPre ? styles.eventKindBadgePre : styles.eventKindBadgePost]}>
                            {isPre ? "Pre" : "Post"}
                          </Text>
                        ) : null}
                        {timeLabel ? (
                          <Text
                            style={[styles.eventChipTime, kindTimeStyle]}
                            numberOfLines={1}
                          >
                            {timeLabel}
                          </Text>
                        ) : null}
                        <Text
                          numberOfLines={view === "month" ? 2 : 4}
                          style={[styles.eventChipTitle, kindTitleStyle]}
                        >
                          {event.title}
                        </Text>
                        {done ? <Text style={styles.eventDoneTag}>Done</Text> : null}
                      </View>
                    );
                  }

                  const chipStyle = cancelled
                    ? styles.eventChipCancelled
                    : pending
                      ? styles.eventChipPending
                      : done
                        ? styles.eventChipDone
                        : styles.eventChipConfirmed;
                  const timeStyle = cancelled
                    ? styles.eventChipTimeCancelled
                    : pending
                      ? styles.eventChipTimePending
                      : done
                        ? styles.eventChipTimeDone
                        : styles.eventChipTimeConfirmed;
                  const titleStyle = cancelled
                    ? styles.eventChipTitleCancelled
                    : pending
                      ? styles.eventChipTitlePending
                      : done
                        ? styles.eventChipTitleDone
                        : styles.eventChipTitleConfirmed;

                  return (
                    <View key={event.id} style={[styles.eventChip, chipStyle]}>
                      {timeLabel ? (
                        <Text style={[styles.eventChipTime, timeStyle]} numberOfLines={1}>
                          {timeLabel}
                        </Text>
                      ) : null}
                      <Text
                        numberOfLines={view === "month" ? 2 : 4}
                        style={[styles.eventChipTitle, titleStyle]}
                      >
                        {event.title}
                      </Text>
                      {!pending && event.crmPatientMessage?.trim() ? (
                        <Text style={styles.eventClinicNote} numberOfLines={2}>
                          Clinic note: {event.crmPatientMessage.trim()}
                        </Text>
                      ) : null}
                      {cancelled && event.cancellationReason?.trim() ? (
                        <Text style={styles.eventCancelReason} numberOfLines={2}>
                          Reason: {event.cancellationReason.trim()}
                        </Text>
                      ) : null}
                      {pending ? (
                        <Text style={styles.eventStatusTagPending}>Pending</Text>
                      ) : null}
                      {cancelled ? (
                        <Text style={styles.eventStatusTagCancelled}>Cancelled</Text>
                      ) : null}
                      {!pending && !done && !cancelled ? (
                        <Text style={styles.eventStatusTagConfirmed}>Confirmed</Text>
                      ) : null}
                      {done ? <Text style={styles.eventDoneTag}>Completed</Text> : null}
                      {pending && (event.attachmentsCount ?? 0) > 0 ? (
                        <Text style={styles.eventPhotoHint}>
                          {event.attachmentsCount} photo
                          {event.attachmentsCount !== 1 ? "s" : ""}
                        </Text>
                      ) : null}
                    </View>
                  );
              })
            )}
          </>
        ) : null;

      const appointmentsDayTap =
        scheduleTab === "appointments" && cellYmd !== null && day !== null;
      return (
        <View
          key={day ? String(day.getTime()) : `e-${idx}`}
          style={[
            styles.gridCell,
            colIndex === 6 && styles.gridCellLastCol,
            { minHeight: cellMinH, backgroundColor: day ? "#fff" : "#f8fafc" },
          ]}
        >
          {appointmentsDayTap ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Request visit for ${cellYmd}`}
              onPress={() => {
                setVisitRequestYmd(cellYmd);
                if (day) setReqCalMonth(day);
                setVisitRequestOpen(true);
              }}
              style={styles.gridCellPressable}
            >
              {dayBody}
            </Pressable>
          ) : (
            dayBody
          )}
        </View>
      );
    }

    return (
      <View style={styles.calCard}>
        <View style={styles.calCardHead}>
          <View style={styles.calCardHeadText}>
            <Text style={styles.calCardTitle}>
              {scheduleTab === "treatment" ? "Treatment & care" : "Appointments"}
            </Text>
            <Text style={styles.calHeaderSub} numberOfLines={scheduleTab === "appointments" ? 3 : 2}>
              {scheduleTab === "appointments"
                ? `${headerLabel}\nTap a day to request a visit for that date.`
                : headerLabel}
            </Text>
          </View>
        </View>
        <View style={styles.toolbarCol}>
          <View style={styles.toolbarTop}>
            <View style={styles.segGroup}>
              <Pressable
                style={[styles.segBtn, view === "month" && styles.segBtnOn]}
                onPress={() => setView("month")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={view === "month" ? "#2B3A67" : "#64748b"}
                  style={{ marginRight: 6 }}
                />
                <Text style={view === "month" ? styles.segBtnTextOn : styles.segBtnText}>Month</Text>
              </Pressable>
              <Pressable
                style={[styles.segBtn, view === "week" && styles.segBtnOn]}
                onPress={() => setView("week")}
              >
                <Ionicons
                  name="today-outline"
                  size={16}
                  color={view === "week" ? "#2B3A67" : "#64748b"}
                  style={{ marginRight: 6 }}
                />
                <Text style={view === "week" ? styles.segBtnTextOn : styles.segBtnText}>Week</Text>
              </Pressable>
            </View>
            <View style={styles.toolbarRight}>
              <Pressable
                style={styles.iconBtn}
                onPress={() => void refreshCalendar()}
                disabled={calendarRefreshing}
              >
                <Ionicons
                  name="refresh"
                  size={20}
                  color="#2B3A67"
                  style={calendarRefreshing ? { opacity: 0.5 } : undefined}
                />
              </Pressable>
              <View style={styles.navGroup}>
                <Pressable style={styles.navBtn} onPress={handlePrev} accessibilityLabel="Previous">
                  <Ionicons name="chevron-back" size={22} color="#3f3f46" />
                </Pressable>
                <View style={styles.navSep} />
                <Pressable style={styles.navBtn} onPress={handleNext} accessibilityLabel="Next">
                  <Ionicons name="chevron-forward" size={22} color="#3f3f46" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.gridOuter}>
          <View style={styles.weekHeadRow}>
            {CAL_DAYS.map((d) => (
              <View key={d} style={styles.weekHeadCell}>
                <Text style={styles.weekHeadText} numberOfLines={1}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {weeks.map((row, ri) => (
            <View key={`w-${ri}`} style={styles.gridRow}>
              {row.map((day, ci) => renderCell(day, ri * 7 + ci, ci))}
            </View>
          ))}
        </View>
        {scheduleTab === "appointments" ? (
          <View style={styles.legendRow}>
            <LegendDot color="#2B3A67" label="Upcoming" />
            <LegendDot color="#16a34a" label="Completed" />
            <LegendDot color="#d97706" label="Requested" />
            <LegendDot color="#dc2626" label="Cancelled" />
            <LegendDot color="#7c3aed" label="Guidelines" />
          </View>
        ) : null}

        <View style={styles.listSection}>
          <Text style={styles.listSectionLabel}>
            {scheduleTab === "treatment"
              ? view === "month"
                ? "Care reminders — this month"
                : "Care reminders — this week"
              : view === "month"
                ? "Visits & requests — this month"
                : "Visits & requests — this week"}
          </Text>
          {listEventsCal.length === 0 ? (
            <Text style={styles.mutedCenter}>
              {scheduleTab === "treatment"
                ? `No care reminders in this ${view === "month" ? "month" : "week"}.`
                : `No visits or requests in this ${view === "month" ? "month" : "week"}.`}
            </Text>
          ) : (
            listEventsCal.map((event) => {
                const pending = event.id.startsWith("req:");
                const cancelled = event.cancelled === true;
                const done = event.completed;
                const whenStyle =
                  cancelled
                    ? styles.listWhenCancelled
                    : pending
                      ? styles.listWhenPending
                      : done
                        ? styles.listWhenDone
                        : styles.listWhenOpen;
                return (
                  <View key={event.id} style={styles.listRow}>
                    <View style={styles.listRowTop}>
                      <Text style={[styles.listWhen, whenStyle]}>
                        {formatScheduleWhen(
                          event.eventDateYmd,
                          event.eventTimeHm,
                          event.eventSlotEndTimeHm
                        )}
                      </Text>
                      {scheduleTab === "treatment" &&
                      (event.eventKind === "pre_treatment" ||
                        event.eventKind === "post_treatment") ? (
                        <Text style={styles.listKindPill}>
                          {event.eventKind === "pre_treatment" ? "Pre" : "Post"}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.listRowBody}>
                      <Text
                        style={[
                          styles.listTitle,
                          done && styles.listTitleDone,
                          cancelled && styles.listTitleCancelled,
                        ]}
                      >
                        {event.title}
                      </Text>
                      {scheduleTab === "appointments" && pending ? (
                        <Text style={styles.pendingPill}>Pending</Text>
                      ) : null}
                      {scheduleTab === "appointments" && cancelled ? (
                        <Text style={styles.cancelledPill}>Cancelled</Text>
                      ) : null}
                      {scheduleTab === "appointments" &&
                      !pending &&
                      !cancelled &&
                      !done ? (
                        <Text style={styles.confirmedPill}>Confirmed</Text>
                      ) : null}
                      {done ? <Text style={styles.completedPill}>Completed</Text> : null}
                    </View>
                    {scheduleTab === "appointments" && !pending && event.crmPatientMessage?.trim() ? (
                      <Text style={styles.listMeta}>
                        Clinic note: {event.crmPatientMessage.trim()}
                      </Text>
                    ) : null}
                    {scheduleTab === "appointments" &&
                    cancelled &&
                    event.cancellationReason?.trim() ? (
                      <Text style={styles.listMetaDanger}>
                        Reason: {event.cancellationReason.trim()}
                      </Text>
                    ) : null}
                    {scheduleTab === "appointments" && pending && (event.attachmentsCount ?? 0) > 0 ? (
                      <Text style={styles.listMeta}>
                        {event.attachmentsCount} photo
                        {event.attachmentsCount !== 1 ? "s" : ""} attached
                      </Text>
                    ) : null}
                  </View>
                );
              })
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await loadAll();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, scheduleTab === "treatment" && styles.tabOn]}
          onPress={() => setScheduleTab("treatment")}
        >
          <Text
            style={scheduleTab === "treatment" ? styles.tabTextOn : styles.tabText}
            numberOfLines={2}
          >
            Treatment & care
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, scheduleTab === "appointments" && styles.tabOn]}
          onPress={() => setScheduleTab("appointments")}
        >
          <Text
            style={scheduleTab === "appointments" ? styles.tabTextOn : styles.tabText}
            numberOfLines={2}
          >
            Appointments
          </Text>
        </Pressable>
      </View>
      {scheduleTab === "appointments" ? (
        <View style={styles.crmCard}>
          <View style={styles.crmIcon}>
            <Ionicons name="shield-checkmark" size={18} color="#2B3A67" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.crmTitle}>Linked with CRM</Text>
            <Text style={styles.crmBody}>
              Your appointments and guidelines, synced in real-time.
            </Text>
          </View>
        </View>
      ) : null}

      {renderCalendarGrid()}
      {scheduleTab === "appointments" ? (
        <>
          {featuredUpcoming ? (
            <Pressable
              style={styles.featureCard}
              onPress={() => router.push("/(drawer)/upcoming-appointments" as any)}
            >
              <View style={styles.featureTopRow}>
                <Text style={styles.upcomingPill}>Upcoming</Text>
                <Ionicons name="chevron-forward" size={20} color="#2B3A67" />
              </View>

              <View style={styles.featureDoctorRow}>
                {featuredUpcoming.doctorPhotoUrl ? (
                  <Image
                    source={{ uri: featuredUpcoming.doctorPhotoUrl }}
                    style={styles.doctorAvatar}
                  />
                ) : (
                  <View style={styles.doctorAvatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureDoctorName}>
                    Dr. {featuredUpcoming.doctorName ?? "Doctor"}
                  </Text>
                  <Text style={styles.featureType}>
                    {featuredUpcoming.appointmentType ?? "Consultation"}
                  </Text>
                </View>
              </View>

              {featuredUpcoming.crmPatientMessage ? (
                <View style={styles.featureNoteBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#2B3A67" />
                  <Text style={styles.featureNoteText} numberOfLines={2}>
                    {featuredUpcoming.crmPatientMessage}
                  </Text>
                </View>
              ) : null}

              <View style={styles.featureTimeRow}>
                <View style={styles.datePill}>
                  <Text style={styles.datePillDay}>
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "EEE")}
                  </Text>
                  <Text style={styles.datePillDate}>
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "dd")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTime}>
                    {formatScheduleWhen(
                      featuredUpcoming.eventDateYmd,
                      featuredUpcoming.eventTimeHm,
                      featuredUpcoming.eventSlotEndTimeHm
                    )}
                  </Text>
                  <Text style={styles.featureMonthYear}>
                    {format(parseLocalYmd(featuredUpcoming.eventDateYmd), "MMMM yyyy")}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.requestCard}
            onPress={() => {
              const ymd = localYmd(new Date());
              setVisitRequestYmd(ymd);
              setVisitNotes("");
              setReqCalMonth(new Date());
              setVisitRequestOpen(true);
            }}
          >
            <Ionicons name="calendar-outline" size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.requestCardTitle}>Request an Appointment</Text>
              <Text style={styles.requestCardSub}>Pick a date & share your preferred time slots.</Text>
            </View>
            <Ionicons name="chevron-forward" size={26} color="#fff" />
          </Pressable>
        </>
      ) : null}

      <Modal
        visible={visitRequestOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVisitRequestOpen(false);
          setVisitRequestYmd(null);
          setVisitNotes("");
          setVisitWindow("morning");
          setSelectedSlots([]);
        }}
      >
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalCardContent} bounces={false}>
            <Text style={styles.requestTitle}>Request Appointment</Text>
            <Text style={styles.muted}>
              {visitRequestYmd
                ? format(parseLocalYmd(visitRequestYmd), "EEEE, MMM d, yyyy")
                : ""}
            </Text>
            <View style={styles.reqCalWrap}>
              <View style={styles.reqCalHeader}>
                <Pressable onPress={() => setReqCalMonth((d) => subMonths(d, 1))} hitSlop={10}>
                  <Ionicons name="chevron-back" size={20} color="#3f3f46" />
                </Pressable>
                <Text style={styles.reqCalMonthLabel}>{format(reqCalMonth, "MMMM yyyy")}</Text>
                <Pressable onPress={() => setReqCalMonth((d) => addMonths(d, 1))} hitSlop={10}>
                  <Ionicons name="chevron-forward" size={20} color="#3f3f46" />
                </Pressable>
              </View>
              <View style={styles.reqCalDaysRow}>
                {CAL_DAYS.map((d) => (
                  <Text key={d} style={styles.reqCalDayHead}>{d}</Text>
                ))}
              </View>
              {chunkWeeks(reqCalCells).map((row, ri) => (
                <View key={ri} style={styles.reqCalRow}>
                  {row.map((day, ci) => {
                    if (!day) return <View key={`e-${ci}`} style={styles.reqCalCell} />;
                    const ymd = localYmd(day);
                    const selected = visitRequestYmd === ymd;
                    const isToday = isSameDay(day, new Date());
                    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                    const hasEvent = getCellEvents(day, appointmentCalendarEvents).length > 0;
                    return (
                      <Pressable
                        key={ymd}
                        style={[
                          styles.reqCalCell,
                          selected && styles.reqCalCellSelected,
                          isToday && !selected && styles.reqCalCellToday,
                        ]}
                        onPress={() => !isPast && setVisitRequestYmd(ymd)}
                        disabled={isPast}
                      >
                        <Text
                          style={[
                            styles.reqCalCellText,
                            selected && styles.reqCalCellTextSelected,
                            isPast && styles.reqCalCellTextPast,
                            isToday && !selected && styles.reqCalCellTextToday,
                          ]}
                        >
                          {getDate(day)}
                        </Text>
                        {hasEvent ? (
                          <View style={[styles.reqCalDot, selected && styles.reqCalDotSelected]} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <Text style={styles.labelBig}>Choose new time</Text>
            <View style={styles.windowTabs}>
              {(["morning", "afternoon", "evening"] as const).map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setVisitWindow(w)}
                  style={[styles.windowTab, visitWindow === w && styles.windowTabOn]}
                >
                  <Text style={visitWindow === w ? styles.windowTabOnText : styles.windowTabText}>
                    {w.charAt(0).toUpperCase() + w.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.slotGrid}>
              {slotOptions[visitWindow].map((slot) => {
                const on = selectedSlots.includes(slot);
                return (
                  <Pressable
                    key={slot}
                    onPress={() => toggleSlot(slot)}
                    style={[styles.slotChip, on && styles.slotChipOn]}
                  >
                    <Text style={on ? styles.slotChipOnText : styles.slotChipText}>{slot}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.noteBox}>
              <Ionicons name="information-circle" size={20} color="#1e3a8a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>Please note</Text>
                <Text style={styles.noteBody}>
                  Requests are subject to clinic confirmation.
                </Text>
              </View>
            </View>
            <Text style={styles.label}>Add notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 76 }]}
              multiline
              value={visitNotes}
              onChangeText={setVisitNotes}
              placeholder="Any symptoms, constraints, or preference for your doctor"
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  setVisitRequestOpen(false);
                  setVisitRequestYmd(null);
                  setVisitNotes("");
                  setVisitWindow("morning");
                  setSelectedSlots([]);
                }}
              >
                <Text style={styles.btnGhostTextStrong}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, visitBusy && { opacity: 0.6 }]}
                onPress={() => void submitVisitRequest()}
                disabled={visitBusy}
              >
                <Text style={styles.btnPrimaryText}>{visitBusy ? "…" : "Send request"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#E8EFE6" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#E8EFE6" },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroKicker: {
    fontSize: 10,
    letterSpacing: 1.3,
    textAlign: "center",
    color: "#2B3A67",
    fontWeight: "800",
  },
  h1: { fontSize: 25, fontWeight: "800", textAlign: "center", color: "#18181b", marginTop: 6 },
  sub: { textAlign: "center", color: "#52525b", marginTop: 6, marginBottom: 2, fontSize: 14 },
  err: { color: "#b91c1c", marginBottom: 8, textAlign: "center" },
  tabs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  tabOn: {
    backgroundColor: "#e8eef6",
    borderWidth: 1,
    borderColor: "rgba(43, 58, 103, 0.35)",
  },
  tabText: { fontWeight: "600", color: "#52525b", fontSize: 14, textAlign: "center" },
  tabTextOn: { fontWeight: "800", color: "#2B3A67", fontSize: 14, textAlign: "center" },
  crmCard: {
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  crmIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  crmTitle: { fontSize: 18, fontWeight: "700", color: "#2a2a2a" },
  crmBody: { marginTop: 6, fontSize: 14, color: "#71717a", lineHeight: 20 },
  muted: { color: "#71717a", fontSize: 14, marginBottom: 8 },
  mutedCenter: { color: "#71717a", fontSize: 14, textAlign: "center", paddingVertical: 8 },
  calCard: {
    marginTop: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    padding: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
    overflow: "hidden",
  },
  appointmentDotsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 3,
    minHeight: 8,
    marginBottom: 2,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  calCardHead: { marginBottom: 4 },
  calCardHeadText: { flex: 1, minWidth: 0 },
  calCardTitle: { fontSize: 19, fontWeight: "800", color: "#18181b", letterSpacing: -0.3 },
  calHeaderSub: { fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 18 },
  toolbarCol: { width: "100%", marginTop: 12, marginBottom: 8 },
  toolbarTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  segGroup: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 4,
    gap: 4,
    flexShrink: 1,
  },
  segBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segBtnOn: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  segBtnTextOn: { fontSize: 13, fontWeight: "700", color: "#2B3A67" },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  navGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  navBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  navSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "#e2e8f0" },
  gridOuter: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    backgroundColor: "#fafafa",
  },
  weekHeadRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  weekHeadCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  weekHeadText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  gridRow: { flexDirection: "row", alignItems: "stretch", width: "100%" },
  gridCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#e2e8f0",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  gridCellPressable: { alignSelf: "stretch" },
  gridCellLastCol: { borderRightWidth: 0 },
  dayNumWrap: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2 },
  dayNumWrapToday: { backgroundColor: "rgba(43, 58, 103, 0.12)" },
  cellDayNum: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  cellDayNumHi: { color: "#2B3A67" },
  cellDayNumToday: { fontWeight: "800", color: "#2B3A67" },
  eventChip: { marginTop: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  eventChipOpen: { backgroundColor: "rgba(232, 238, 246, 0.95)", borderWidth: 1, borderColor: "rgba(43, 58, 103, 0.3)" },
  eventChipPre: { backgroundColor: "rgba(219, 234, 254, 0.95)", borderWidth: 1, borderColor: "rgba(30, 64, 175, 0.45)" },
  eventChipPost: { backgroundColor: "rgba(237, 233, 254, 0.95)", borderWidth: 1, borderColor: "rgba(109, 40, 217, 0.45)" },
  eventChipDone: { backgroundColor: "rgba(224, 242, 254, 0.95)", borderWidth: 1, borderColor: "rgba(14, 165, 233, 0.35)" },
  eventChipPending: {
    backgroundColor: "rgba(254, 243, 199, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.4)",
  },
  eventChipConfirmed: {
    backgroundColor: "rgba(232, 238, 246, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(43, 58, 103, 0.3)",
  },
  eventChipCancelled: {
    backgroundColor: "rgba(244, 244, 245, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(113, 113, 122, 0.45)",
  },
  eventChipTime: { fontSize: 10, fontWeight: "700" },
  eventChipTimeOpen: { color: "#2B3A67" },
  eventChipTimePre: { color: "#1e3a8a" },
  eventChipTimePost: { color: "#5b21b6" },
  eventChipTimeDone: { color: "#0c4a6e" },
  eventChipTimePending: { color: "#b45309" },
  eventChipTimeConfirmed: { color: "#2B3A67" },
  eventChipTimeCancelled: { color: "#52525b" },
  eventChipTitle: { fontSize: 10, fontWeight: "600" },
  eventChipTitleOpen: { color: "#2B3A67" },
  eventChipTitlePre: { color: "#1e3a8a" },
  eventChipTitlePost: { color: "#5b21b6" },
  eventChipTitleDone: { color: "#0c4a6e" },
  eventChipTitlePending: { color: "#92400e" },
  eventChipTitleConfirmed: { color: "#2B3A67" },
  eventChipTitleCancelled: { color: "#52525b" },
  eventKindBadge: {
    fontSize: 8,
    fontWeight: "800",
    color: "#2B3A67",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  eventKindBadgePre: {
    color: "#1e3a8a",
  },
  eventKindBadgePost: {
    color: "#5b21b6",
  },
  eventClinicNote: { fontSize: 9, color: "#475569", marginTop: 2 },
  eventCancelReason: { fontSize: 9, color: "#b91c1c", marginTop: 2 },
  eventStatusTagPending: {
    fontSize: 8,
    fontWeight: "700",
    color: "#b45309",
    marginTop: 2,
    textTransform: "uppercase",
  },
  eventStatusTagConfirmed: {
    fontSize: 8,
    fontWeight: "700",
    color: "#2B3A67",
    marginTop: 2,
    textTransform: "uppercase",
  },
  eventStatusTagCancelled: {
    fontSize: 8,
    fontWeight: "700",
    color: "#52525b",
    marginTop: 2,
    textTransform: "uppercase",
  },
  eventPhotoHint: { fontSize: 9, color: "#64748b", marginTop: 2 },
  eventDoneTag: { fontSize: 8, fontWeight: "700", color: "#0369a1", marginTop: 2, textTransform: "uppercase" },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e4e4e7",
    marginTop: 12,
    paddingTop: 10,
  },
  legendDot: { width: 10, height: 10, borderRadius: 999, marginTop: 4 },
  legendLabel: { fontSize: 12, color: "#3f3f46", fontWeight: "600" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  featureCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: "#f8faf8",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  featureTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  upcomingPill: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2B3A67",
    borderWidth: 1,
    borderColor: "#2B3A67",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  featureDoctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  doctorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2B3A67",
    alignItems: "center",
    justifyContent: "center",
  },
  featureDoctorName: { fontSize: 16, fontWeight: "700", color: "#18181b" },
  featureType: { fontSize: 13, color: "#71717a", marginTop: 1 },
  featureNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#f0f4ff",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  featureNoteText: { flex: 1, fontSize: 13, color: "#2B3A67", lineHeight: 18 },
  featureTimeRow: { marginTop: 14, flexDirection: "row", gap: 14, alignItems: "center" },
  featureMonthYear: { fontSize: 13, color: "#71717a", marginTop: 2 },
  datePill: {
    width: 78,
    height: 88,
    borderRadius: 18,
    backgroundColor: "#262b74",
    alignItems: "center",
    justifyContent: "center",
  },
  datePillDay: { color: "#fff", fontSize: 14, fontWeight: "700" },
  datePillDate: { color: "#fff", fontSize: 26, fontWeight: "700", marginTop: 2 },
  featureTime: { fontSize: 16, fontWeight: "700", color: "#2f2f2f" },
  featureLoc: { marginTop: 4, fontSize: 13, color: "#71717a" },
  requestCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#272d77",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    shadowColor: "#272d77",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  requestCardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  requestCardSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4, lineHeight: 20 },
  listSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e4e4e7",
    backgroundColor: "rgba(253, 249, 240, 0.65)",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  listSectionLabel: { fontSize: 11, fontWeight: "700", color: "#71717a", textTransform: "uppercase", marginBottom: 10 },
  listRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    padding: 12,
    marginBottom: 8,
  },
  listWhen: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  listWhenOpen: { color: "#2B3A67" },
  listWhenDone: { color: "#0369a1" },
  listWhenPending: { color: "#b45309" },
  listWhenCancelled: { color: "#52525b" },
  listRowTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  listRowBody: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  listTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#18181b", minWidth: "60%" },
  listTitleDone: { color: "#52525b" },
  listTitleCancelled: { color: "#71717a" },
  listKindPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2B3A67",
    backgroundColor: "#e8eef6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  listMeta: { fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 18 },
  listMetaDanger: { fontSize: 13, color: "#b91c1c", marginTop: 8, lineHeight: 18 },
  pendingPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
  },
  confirmedPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2B3A67",
    backgroundColor: "#e8eef6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
  },
  cancelledPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#52525b",
    backgroundColor: "#e4e4e7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
  },
  completedPill: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0c4a6e",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textTransform: "uppercase",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "92%",
  },
  modalCardContent: {
    padding: 20,
    paddingBottom: 36,
  },
  requestTitle: { fontSize: 22, fontWeight: "800", color: "#18181b", textAlign: "center" },
  reqCalWrap: {
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  reqCalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  reqCalMonthLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#18181b",
  },
  reqCalDaysRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  reqCalDayHead: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  reqCalRow: {
    flexDirection: "row",
  },
  reqCalCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  reqCalCellSelected: {
    backgroundColor: "#262b74",
  },
  reqCalCellToday: {
    backgroundColor: "rgba(13,148,136,0.12)",
  },
  reqCalCellText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reqCalCellTextSelected: {
    color: "#fff",
    fontWeight: "800",
  },
  reqCalCellTextPast: {
    color: "#d1d5db",
  },
  reqCalCellTextToday: {
    color: "#2B3A67",
    fontWeight: "800",
  },
  reqCalDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
    marginTop: 3,
  },
  reqCalDotSelected: {
    backgroundColor: "#22c55e",
  },
  labelBig: { fontSize: 17, fontWeight: "700", color: "#18181b", marginTop: 8, marginBottom: 10 },
  windowTabs: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  windowTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  windowTabOn: { backgroundColor: "#e4e4e7" },
  windowTabText: { color: "#52525b", fontWeight: "600", fontSize: 16 },
  windowTabOnText: { color: "#1e3a8a", fontWeight: "700", fontSize: 16 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  slotChip: {
    width: "31%",
    minWidth: 95,
    backgroundColor: "#f4f4f5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  slotChipOn: { backgroundColor: "#262b74" },
  slotChipText: { color: "#3f3f46", fontWeight: "600", fontSize: 14 },
  slotChipOnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  noteBox: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fafafa",
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noteTitle: { fontSize: 16, fontWeight: "700", color: "#1e3a8a" },
  noteBody: { marginTop: 4, fontSize: 14, color: "#52525b", lineHeight: 20 },
  label: { fontSize: 13, color: "#52525b", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  btnGhost: { padding: 12 },
  btnGhostTextStrong: { fontSize: 15, fontWeight: "700", color: "#52525b" },
  btnPrimary: { backgroundColor: "#262b74", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
