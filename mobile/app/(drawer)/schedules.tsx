import { Ionicons } from "@expo/vector-icons";
import {
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
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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
  const [visitBusy, setVisitBusy] = useState(false);

  const calendarCells = useMemo(
    () => buildCalendarCells(currentDate, view),
    [currentDate, view]
  );

  const appointmentCalendarEvents = useMemo(() => {
    return [
      ...appointmentEvents,
      ...pendingToSyntheticEvents(pendingRequests),
      ...closedToSynthetic(closedRequests),
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
    const issue = visitIssue.trim();
    if (issue.length < 2) {
      Alert.alert("Request", "Please describe your issue.");
      return;
    }
    const t = visitTimes.trim();
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
      await loadBootstrap();
    } catch (e) {
      Alert.alert("Request", e instanceof Error ? e.message : "Failed.");
    } finally {
      setVisitBusy(false);
    }
  }

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
            {cellEvents.map((event) => {
                  const timeLabel = formatEventTimeChip(
                    event.eventTimeHm,
                    event.eventSlotEndTimeHm
                  );
                  const pending = event.id.startsWith("req:");
                  const cancelled = event.cancelled === true;
                  const done = event.completed;

                  if (scheduleTab === "treatment") {
                    return (
                      <View
                        key={event.id}
                        style={[styles.eventChip, done ? styles.eventChipDone : styles.eventChipOpen]}
                      >
                        {event.eventKind === "pre_treatment" ||
                        event.eventKind === "post_treatment" ? (
                          <Text style={styles.eventKindBadge}>
                            {event.eventKind === "pre_treatment" ? "Pre" : "Post"}
                          </Text>
                        ) : null}
                        {timeLabel ? (
                          <Text
                            style={[
                              styles.eventChipTime,
                              done ? styles.eventChipTimeDone : styles.eventChipTimeOpen,
                            ]}
                            numberOfLines={1}
                          >
                            {timeLabel}
                          </Text>
                        ) : null}
                        <Text
                          numberOfLines={view === "month" ? 2 : 4}
                          style={[
                            styles.eventChipTitle,
                            done ? styles.eventChipTitleDone : styles.eventChipTitleOpen,
                          ]}
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
            })}
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
                  color={view === "month" ? "#115e59" : "#64748b"}
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
                  color={view === "week" ? "#115e59" : "#64748b"}
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
                  color="#115e59"
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
      <Text style={styles.h1}>Schedules & tasks</Text>
      <Text style={styles.sub}>Stay on top of your skincare journey.</Text>
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

      {renderCalendarGrid()}

      <Modal
        visible={visitRequestOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setVisitRequestOpen(false);
          setVisitRequestYmd(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Request a visit</Text>
            <Text style={styles.muted}>
              {visitRequestYmd
                ? format(parseLocalYmd(visitRequestYmd), "EEEE, MMM d, yyyy")
                : ""}
            </Text>
            <Text style={styles.label}>What should we know? (issue)</Text>
            <TextInput style={styles.input} value={visitIssue} onChangeText={setVisitIssue} />
            <Text style={styles.label}>Days affected (optional)</Text>
            <TextInput
              style={styles.input}
              value={visitDaysAffected}
              onChangeText={setVisitDaysAffected}
              keyboardType="number-pad"
              placeholder="e.g. 7"
            />
            <Text style={styles.label}>Preferred times / availability</Text>
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={visitTimes}
              onChangeText={setVisitTimes}
              placeholder="e.g. weekday mornings"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.btnGhost}
                onPress={() => {
                  setVisitRequestOpen(false);
                  setVisitRequestYmd(null);
                }}
              >
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                onPress={() => void submitVisitRequest()}
                disabled={visitBusy}
              >
                <Text style={styles.btnPrimaryText}>{visitBusy ? "…" : "Send request"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#fdf9f0" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fdf9f0" },
  h1: { fontSize: 22, fontWeight: "700", textAlign: "center", color: "#18181b" },
  sub: { textAlign: "center", color: "#52525b", marginTop: 6, marginBottom: 12 },
  err: { color: "#b91c1c", marginBottom: 8, textAlign: "center" },
  tabs: { flexDirection: "row", gap: 8, marginVertical: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#e4e4e7",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  tabOn: { backgroundColor: "#ccfbf1" },
  tabText: { fontWeight: "600", color: "#52525b", fontSize: 14, textAlign: "center" },
  tabTextOn: { fontWeight: "700", color: "#0f766e", fontSize: 14, textAlign: "center" },
  muted: { color: "#71717a", fontSize: 14, marginBottom: 8 },
  mutedCenter: { color: "#71717a", fontSize: 14, textAlign: "center", paddingVertical: 8 },
  calCard: {
    marginTop: 20,
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
  segBtnTextOn: { fontSize: 13, fontWeight: "700", color: "#115e59" },
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
  dayNumWrapToday: { backgroundColor: "rgba(13, 148, 136, 0.14)" },
  cellDayNum: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  cellDayNumHi: { color: "#0f766e" },
  cellDayNumToday: { fontWeight: "800", color: "#0f766e" },
  eventChip: { marginTop: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  eventChipOpen: { backgroundColor: "rgba(224, 240, 237, 0.95)", borderWidth: 1, borderColor: "rgba(13, 148, 136, 0.35)" },
  eventChipDone: { backgroundColor: "rgba(224, 242, 254, 0.95)", borderWidth: 1, borderColor: "rgba(14, 165, 233, 0.35)" },
  eventChipPending: {
    backgroundColor: "rgba(254, 243, 199, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.4)",
  },
  eventChipConfirmed: {
    backgroundColor: "rgba(224, 240, 237, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.35)",
  },
  eventChipCancelled: {
    backgroundColor: "rgba(244, 244, 245, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(113, 113, 122, 0.45)",
  },
  eventChipTime: { fontSize: 10, fontWeight: "700" },
  eventChipTimeOpen: { color: "#115e59" },
  eventChipTimeDone: { color: "#0c4a6e" },
  eventChipTimePending: { color: "#b45309" },
  eventChipTimeConfirmed: { color: "#115e59" },
  eventChipTimeCancelled: { color: "#52525b" },
  eventChipTitle: { fontSize: 10, fontWeight: "600" },
  eventChipTitleOpen: { color: "#115e59" },
  eventChipTitleDone: { color: "#0c4a6e" },
  eventChipTitlePending: { color: "#92400e" },
  eventChipTitleConfirmed: { color: "#115e59" },
  eventChipTitleCancelled: { color: "#52525b" },
  eventKindBadge: {
    fontSize: 8,
    fontWeight: "800",
    color: "#0f766e",
    marginBottom: 2,
    textTransform: "uppercase",
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
    color: "#0f766e",
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
  listWhenOpen: { color: "#0f766e" },
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
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
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
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
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
    padding: 20,
    paddingBottom: 36,
  },
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
  btnPrimary: { backgroundColor: "#0d9488", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
