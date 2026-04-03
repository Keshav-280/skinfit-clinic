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
  apiRangeFromView,
  buildCalendarCells,
  CAL_DAYS,
  doctorSlotStatusLabel,
  doctorSlotToneRn,
  eventsInMonth,
  eventsInWeek,
  formatDoctorSlotHmRangeLabel,
  formatScheduleWhen,
  formatTimeHmShort,
  getCellEvents,
  localYmd,
  parseLocalYmd,
  type DoctorCalendarSlot,
  type ScheduleEventRow,
  WEEK_OPTS,
} from "@/lib/schedulesCalendar";

type PriorityReminderRow = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  sortOrder: number;
};

type CompletedReminderHistoryRow = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  completedAtIso: string;
};

type DoctorRow = { id: string; name: string; email: string };

function chunkWeeks<T>(cells: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

const TEAL = "#0d9488";

export default function SchedulesScreen() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"mine" | "doctor">("mine");
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [activeReminders, setActiveReminders] = useState<PriorityReminderRow[]>([]);
  const [completedHistory, setCompletedHistory] = useState<CompletedReminderHistoryRow[]>([]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorSlots, setDoctorSlots] = useState<DoctorCalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarRefreshing, setCalendarRefreshing] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [requestSlot, setRequestSlot] = useState<DoctorCalendarSlot | null>(null);
  const [requestIssue, setRequestIssue] = useState("Skin concern");
  const [requestWhy, setRequestWhy] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  const range = useMemo(() => apiRangeFromView(currentDate, view), [currentDate, view]);
  const calendarCells = useMemo(
    () => buildCalendarCells(currentDate, view),
    [currentDate, view]
  );

  const headerLabel =
    view === "month"
      ? format(currentDate, "MMMM yyyy")
      : `Week of ${format(startOfWeek(currentDate, WEEK_OPTS), "MMM d")} – ${format(endOfWeek(currentDate, WEEK_OPTS), "MMM d, yyyy")}`;

  const loadBootstrap = useCallback(async () => {
    if (!token) return;
    const json = await apiJson<{
      initialActiveReminders: PriorityReminderRow[];
      initialCompletedHistory: CompletedReminderHistoryRow[];
      initialScheduleEvents: ScheduleEventRow[];
    }>("/api/patient/schedules", token, { method: "GET" });
    setActiveReminders(json.initialActiveReminders);
    setCompletedHistory(json.initialCompletedHistory);
    setScheduleEvents(json.initialScheduleEvents);
  }, [token]);

  const loadDoctors = useCallback(async () => {
    if (!token) return;
    const json = await apiJson<{ doctors: DoctorRow[] }>("/api/clinic/doctors", token, {
      method: "GET",
    });
    setDoctors(json.doctors ?? []);
    setDoctorId((prev) => prev ?? json.doctors[0]?.id ?? null);
  }, [token]);

  const loadDoctorCalendar = useCallback(async () => {
    if (!token || !doctorId) return;
    setDoctorLoading(true);
    setDoctorError(null);
    try {
      const q = `/api/calendar/patient/doctor/${encodeURIComponent(doctorId)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const json = await apiJson<{ slots: DoctorCalendarSlot[]; error?: string }>(
        q,
        token,
        { method: "GET" }
      );
      setDoctorSlots(json.slots ?? []);
    } catch (e) {
      setDoctorError(e instanceof ApiError ? e.message : "Could not load doctor calendar.");
      setDoctorSlots([]);
    } finally {
      setDoctorLoading(false);
    }
  }, [token, doctorId, range.from, range.to]);

  const loadAll = useCallback(async () => {
    setError(null);
    await loadBootstrap();
    await loadDoctors();
  }, [loadBootstrap, loadDoctors]);

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

  useEffect(() => {
    if (tab === "doctor" && doctorId) {
      void loadDoctorCalendar();
    }
  }, [tab, doctorId, loadDoctorCalendar]);

  const doctorList = useMemo(
    () =>
      [...doctorSlots].sort((a, b) =>
        `${a.slotDate}T${a.slotTimeHm}`.localeCompare(`${b.slotDate}T${b.slotTimeHm}`)
      ),
    [doctorSlots]
  );

  const myDoctorBookingsList = useMemo(
    () => doctorList.filter((s) => s.bookedByMe),
    [doctorList]
  );

  const listEventsMine = useMemo(
    () =>
      view === "month"
        ? eventsInMonth(scheduleEvents, currentDate)
        : eventsInWeek(scheduleEvents, currentDate),
    [view, scheduleEvents, currentDate]
  );

  async function toggleReminder(id: string, completed: boolean) {
    if (!token) return;
    try {
      await apiJson("/api/reminders", token, {
        method: "PATCH",
        body: JSON.stringify({ id, completed }),
      });
      await loadBootstrap();
    } catch {
      Alert.alert("Reminders", "Could not update.");
    }
  }

  async function submitRequest() {
    if (!token || !doctorId || !requestSlot) return;
    const issueTrim = requestIssue.trim();
    if (!issueTrim) {
      Alert.alert("Request", "Enter a short issue.");
      return;
    }
    setRequestBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/appointments/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId,
          doctorSlotId: requestSlot.id,
          issue: issueTrim,
          why: requestWhy.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; request?: { id: string } };
      if (!res.ok) {
        if (res.status === 409 && data.error === "SLOT_REQUEST_PENDING") {
          throw new Error(
            "Another patient already requested this slot. It will open again if the clinic declines."
          );
        }
        if (res.status === 409 && data.error === "SLOT_ALREADY_BOOKED") {
          throw new Error("This time is already booked.");
        }
        throw new Error(data.error || "Request failed.");
      }
      setModalOpen(false);
      setRequestSlot(null);
      setRequestIssue("Skin concern");
      setRequestWhy("");
      await loadDoctorCalendar();
      await loadBootstrap();
    } catch (e) {
      Alert.alert("Request", e instanceof Error ? e.message : "Failed.");
    } finally {
      setRequestBusy(false);
    }
  }

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
      if (tab === "doctor" && doctorId) await loadDoctorCalendar();
    } finally {
      setCalendarRefreshing(false);
    }
  }

  const cellMinH = view === "week" ? 128 : tab === "doctor" ? 88 : 72;

  function renderCalendarGrid() {
    const weeks = chunkWeeks(calendarCells);
    const now = new Date();

    function renderCell(day: Date | null, idx: number, colIndex: number) {
      const cellYmd = day ? localYmd(day) : null;
      const cellEvents = tab === "mine" ? getCellEvents(day, scheduleEvents) : [];
      const cellSlots =
        tab === "doctor" && day ? doctorList.filter((s) => s.slotDate === cellYmd) : [];
      const hasContent = tab === "mine" ? cellEvents.length > 0 : cellSlots.length > 0;
      const isToday = day ? isSameDay(day, now) : false;

      return (
        <View
          key={day ? String(day.getTime()) : `e-${idx}`}
          style={[
            styles.gridCell,
            colIndex === 6 && styles.gridCellLastCol,
            { minHeight: cellMinH, backgroundColor: day ? "#fff" : "#f8fafc" },
          ]}
        >
          {day !== null ? (
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
              {tab === "mine" ? (
                <>
                  {cellEvents.map((event) => {
                    const timeLabel = formatTimeHmShort(event.eventTimeHm);
                    const done = event.completed;
                    return (
                      <View
                        key={event.id}
                        style={[styles.eventChip, done ? styles.eventChipDone : styles.eventChipOpen]}
                      >
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
                  })}
                </>
              ) : (
                <>
                  {cellSlots.slice(0, view === "month" ? 2 : 4).map((slot) => {
                    const tone = doctorSlotToneRn(slot);
                    const timeDisplay = formatDoctorSlotHmRangeLabel(
                      slot.slotTimeHm,
                      slot.slotEndTimeHm
                    );
                    const statusLabel = doctorSlotStatusLabel(slot);
                    return (
                      <View key={slot.id} style={[styles.slotChip, tone.chip]}>
                        <Text
                          style={[styles.slotChipTime, { color: tone.labelColor }]}
                          numberOfLines={1}
                        >
                          {timeDisplay}
                        </Text>
                        <Text
                          numberOfLines={view === "month" ? 1 : 2}
                          style={[styles.slotChipTitle, { color: tone.labelColor }]}
                        >
                          {slot.title}
                        </Text>
                        {slot.cancelledReason ? (
                          <Text style={styles.slotCancelled} numberOfLines={1}>
                            Cancelled
                          </Text>
                        ) : null}
                        {slot.status === "available" ? (
                          <Pressable
                            style={styles.slotReqBtn}
                            onPress={() => {
                              setRequestSlot(slot);
                              setModalOpen(true);
                            }}
                          >
                            <Text style={styles.slotReqBtnText}>Request</Text>
                          </Pressable>
                        ) : (
                          <Text
                            style={[styles.slotStatus, { color: tone.labelColor }]}
                            numberOfLines={1}
                          >
                            {statusLabel}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                  {cellSlots.length > (view === "month" ? 2 : 4) ? (
                    <Text style={styles.moreSlots} numberOfLines={1}>
                      +{cellSlots.length - (view === "month" ? 2 : 4)}
                    </Text>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.calCard}>
        <View style={styles.calCardHead}>
          <View style={styles.calCardHeadText}>
            <Text style={styles.calCardTitle}>
              {tab === "mine" ? "My calendar" : "Doctor calendar"}
            </Text>
            <Text style={styles.calHeaderSub} numberOfLines={2}>
              {headerLabel}
            </Text>
          </View>
        </View>
        {tab === "doctor" && doctorError ? <Text style={styles.errSmall}>{doctorError}</Text> : null}

        {tab === "doctor" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.docChipScroll}
            contentContainerStyle={styles.docChipScrollContent}
          >
            {doctors.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.docChip, doctorId === d.id && styles.docChipOn]}
                onPress={() => setDoctorId(d.id)}
              >
                <Text
                  style={doctorId === d.id ? styles.docChipTextOn : styles.docChipText}
                  numberOfLines={1}
                >
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

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

          {tab === "doctor" && doctorLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={TEAL} />
          ) : (
            weeks.map((row, ri) => (
              <View key={`w-${ri}`} style={styles.gridRow}>
                {row.map((day, ci) => renderCell(day, ri * 7 + ci, ci))}
              </View>
            ))
          )}
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listSectionLabel}>
            {tab === "mine"
              ? view === "month"
                ? "This month"
                : "This week"
              : view === "month"
                ? "Your appointments with this doctor"
                : "Your appointments this week"}
          </Text>
          {tab === "mine" ? (
            listEventsMine.length === 0 ? (
              <Text style={styles.mutedCenter}>
                No events in this {view === "month" ? "month" : "week"}.
              </Text>
            ) : (
              listEventsMine.map((event) => (
                <View key={event.id} style={styles.listRow}>
                  <Text
                    style={[
                      styles.listWhen,
                      event.completed ? styles.listWhenDone : styles.listWhenOpen,
                    ]}
                  >
                    {formatScheduleWhen(event.eventDateYmd, event.eventTimeHm)}
                  </Text>
                  <View style={styles.listRowBody}>
                    <Text
                      style={[
                        styles.listTitle,
                        event.completed && styles.listTitleDone,
                      ]}
                    >
                      {event.title}
                    </Text>
                    {event.completed ? (
                      <Text style={styles.completedPill}>Completed</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )
          ) : doctorLoading ? (
            <Text style={styles.mutedCenter}>Loading doctor slots…</Text>
          ) : doctorList.length === 0 ? (
            <Text style={styles.mutedCenter}>
              No doctor slots in this range. The clinic adds available times here.
            </Text>
          ) : myDoctorBookingsList.length === 0 ? (
            <Text style={styles.mutedCenter}>
              {"You don't have any requests or confirmed appointments with this doctor in "}
              {view === "month" ? "this month" : "this week"}
              {". Open a time on the calendar above to request one."}
            </Text>
          ) : (
            myDoctorBookingsList.map((slot) => {
              const tone = doctorSlotToneRn(slot);
              const statusLabel =
                slot.status === "requested"
                  ? "Requested"
                  : slot.status === "held"
                    ? "Pending review"
                    : slot.status === "booked"
                      ? "Booked"
                      : slot.status === "completed"
                        ? "Done"
                        : slot.status === "cancelled"
                          ? "Cancelled"
                          : "Closed";
              return (
                <View key={slot.id} style={styles.docListRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docListTime}>
                      {formatDoctorSlotHmRangeLabel(slot.slotTimeHm, slot.slotEndTimeHm)}
                    </Text>
                    <Text style={styles.docListTitle}>{slot.title}</Text>
                    <Text style={styles.docListDate}>
                      {format(parseLocalYmd(slot.slotDate), "EEE, MMM d, yyyy")}
                    </Text>
                    {slot.cancelledReason ? (
                      <Text style={styles.docListCancelled}>Cancelled: {slot.cancelledReason}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.statusPill, { borderColor: tone.chip.borderColor as string }]}>
                    {statusLabel}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  }

  if (loading && activeReminders.length === 0 && scheduleEvents.length === 0) {
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
              if (tab === "doctor") await loadDoctorCalendar();
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
          style={[styles.tab, tab === "mine" && styles.tabOn]}
          onPress={() => setTab("mine")}
        >
          <Text style={tab === "mine" ? styles.tabTextOn : styles.tabText}>My calendar</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "doctor" && styles.tabOn]}
          onPress={() => setTab("doctor")}
        >
          <Text style={tab === "doctor" ? styles.tabTextOn : styles.tabText}>Doctor</Text>
        </Pressable>
      </View>

      {tab === "mine" ? (
        <>
          <Text style={styles.section}>Priority reminders</Text>
          {activeReminders.length === 0 ? (
            <Text style={styles.muted}>No active reminders.</Text>
          ) : (
            activeReminders.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.pill}>{r.priority}</Text>
                </View>
                <Pressable style={styles.doneBtn} onPress={() => toggleReminder(r.id, true)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              </View>
            ))
          )}

          {completedHistory.length > 0 ? (
            <>
              <Text style={[styles.section, { marginTop: 20 }]}>Recently completed</Text>
              {completedHistory.slice(0, 8).map((h) => (
                <View key={h.id} style={styles.doneRow}>
                  <Text style={styles.rowTitle}>{h.title}</Text>
                  <Text style={styles.muted}>{new Date(h.completedAtIso).toLocaleString()}</Text>
                  <Pressable onPress={() => toggleReminder(h.id, false)}>
                    <Text style={styles.undo}>Undo</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          {renderCalendarGrid()}
        </>
      ) : (
        <>{renderCalendarGrid()}</>
      )}

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Request appointment</Text>
            <Text style={styles.muted}>
              {requestSlot ? `${requestSlot.slotDate} ${requestSlot.slotTimeHm}` : ""}
            </Text>
            <Text style={styles.label}>Issue</Text>
            <TextInput style={styles.input} value={requestIssue} onChangeText={setRequestIssue} />
            <Text style={styles.label}>Why (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={requestWhy}
              onChangeText={setRequestWhy}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.btnGhost} onPress={() => setModalOpen(false)}>
                <Text>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={submitRequest} disabled={requestBusy}>
                <Text style={styles.btnPrimaryText}>{requestBusy ? "…" : "Send"}</Text>
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
  errSmall: { color: "#b91c1c", fontSize: 12, marginBottom: 8 },
  tabs: { flexDirection: "row", gap: 8, marginVertical: 12 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#e4e4e7", alignItems: "center" },
  tabOn: { backgroundColor: "#ccfbf1" },
  tabText: { fontWeight: "600", color: "#52525b" },
  tabTextOn: { fontWeight: "700", color: "#0f766e" },
  section: { fontSize: 17, fontWeight: "700", marginBottom: 10, color: "#18181b" },
  muted: { color: "#71717a", fontSize: 14, marginBottom: 8 },
  mutedCenter: { color: "#71717a", fontSize: 14, textAlign: "center", paddingVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
  },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  pill: { fontSize: 12, color: "#0d9488", marginTop: 4, textTransform: "capitalize" },
  doneBtn: { backgroundColor: "#0d9488", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  doneBtnText: { color: "#fff", fontWeight: "600" },
  doneRow: {
    backgroundColor: "#fafafa",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
  },
  undo: { color: "#0d9488", fontWeight: "600", marginTop: 6 },
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
  docChipScroll: { marginTop: 10, marginBottom: 2 },
  docChipScrollContent: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  docChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    maxWidth: "100%",
  },
  docChipOn: { backgroundColor: TEAL },
  docChipText: { fontWeight: "600", color: "#334155", fontSize: 14 },
  docChipTextOn: { fontWeight: "700", color: "#fff", fontSize: 14 },
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
  gridCellLastCol: { borderRightWidth: 0 },
  dayNumWrap: { alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 2 },
  dayNumWrapToday: { backgroundColor: "rgba(13, 148, 136, 0.14)" },
  cellDayNum: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  cellDayNumHi: { color: "#0f766e" },
  cellDayNumToday: { fontWeight: "800", color: "#0f766e" },
  eventChip: { marginTop: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  eventChipOpen: { backgroundColor: "rgba(224, 240, 237, 0.95)", borderWidth: 1, borderColor: "rgba(13, 148, 136, 0.35)" },
  eventChipDone: { backgroundColor: "rgba(224, 242, 254, 0.95)", borderWidth: 1, borderColor: "rgba(14, 165, 233, 0.35)" },
  eventChipTime: { fontSize: 10, fontWeight: "700" },
  eventChipTimeOpen: { color: "#115e59" },
  eventChipTimeDone: { color: "#0c4a6e" },
  eventChipTitle: { fontSize: 10, fontWeight: "600" },
  eventChipTitleOpen: { color: "#115e59" },
  eventChipTitleDone: { color: "#0c4a6e" },
  eventDoneTag: { fontSize: 8, fontWeight: "700", color: "#0369a1", marginTop: 2, textTransform: "uppercase" },
  slotChip: { marginTop: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  slotChipTime: { fontSize: 10, fontWeight: "700" },
  slotChipTitle: { fontSize: 10, fontWeight: "600" },
  slotCancelled: { fontSize: 10, color: "#52525b" },
  slotReqBtn: { marginTop: 4, backgroundColor: "#0d9488", borderRadius: 6, paddingVertical: 4, alignItems: "center" },
  slotReqBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  slotStatus: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  moreSlots: { fontSize: 10, color: "#71717a", marginTop: 2 },
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
  listRowBody: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  listTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: "#18181b", minWidth: "60%" },
  listTitleDone: { color: "#52525b" },
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
  docListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    padding: 14,
    marginBottom: 8,
  },
  docListTime: { fontSize: 15, fontWeight: "700", color: "#115e59" },
  docListTitle: { fontSize: 15, fontWeight: "600", color: "#18181b", marginTop: 4 },
  docListDate: { fontSize: 12, color: "#71717a", marginTop: 4 },
  docListCancelled: { fontSize: 12, color: "#b91c1c", marginTop: 4 },
  statusPill: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#fafafa",
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
