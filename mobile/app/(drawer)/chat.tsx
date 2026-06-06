import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatMessageMarkdown } from "@/components/ChatMessageMarkdown";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { configurePlaybackAudioMode, configureRecordingAudioMode } from "@/lib/audioSession";
import { connectChatSseStream } from "@/lib/chatSse";
import { mapDisplayChatMessages } from "../../../src/lib/chatE2ee/format";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
  markClinicSupportInboxSeenFromServer,
  markDoctorInboxSeenFromServer,
  notifyInboxUnreadChanged,
  setSupplementalDoctorUnread,
} from "@/lib/inboxReadCursors";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";
import {
  AI_CHATBOT_ENABLED,
  DEFAULT_PATIENT_CHAT_ASSISTANT,
} from "@/lib/featureFlags";
import { DoctorChatClinicVisitGate } from "@/components/chat/DoctorChatClinicVisitGate";
import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "../../../src/lib/patientClinicVisitMessages";

type AssistantId = "ai" | "doctor" | "support";
type HomeThreadId = AssistantId | "appointments";
type ThreadScope = "all" | "appointments";

/** API + DB use patient | doctor | support (AI assistant rows use sender "support"). */
type ChatSender = "patient" | "doctor" | "support";

type ChatMsg = {
  id: string;
  sender: ChatSender;
  text: string;
  attachmentUrl?: string | null;
  createdAt?: string;
};

type HomeConversation = {
  id: HomeThreadId;
  title: string;
  subtitle: string;
  unread: number;
  dateLabel?: string;
};

type RegisteredDoctor = {
  id: string;
  name: string;
  specialty: string;
  imageUrl?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  hasUnreadClinicMessage?: boolean;
};

type DoctorProfile = {
  name: string;
  subtitle: string;
  replyHint: string;
  avatarUrl?: string;
};

const TEAL = SKINFIT_THEME.navy;
const CREAM = SKINFIT_THEME.mintDeep;
const ZINC_900 = SKINFIT_THEME.text;
const NAVY = SKINFIT_THEME.navy;

const CONTACTS: {
  id: AssistantId;
  name: string;
  short: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  accentSoft: string;
}[] = [
  {
    id: "ai",
    name: "SkinnFit AI Assistant",
    short: "AI",
    subtitle: "Instant answers about skincare & your scans",
    icon: "sparkles",
    accent: TEAL,
    accentSoft: "rgba(13, 148, 136, 0.12)",
  },
  {
    id: "doctor",
    name: "Doctor",
    short: "Doctor",
    subtitle: "Clinical questions for your dermatologist",
    icon: "medkit",
    accent: "#2563eb",
    accentSoft: "rgba(37, 99, 235, 0.1)",
  },
  {
    id: "support",
    name: "Clinic Support",
    short: "Support",
    subtitle: "Booking, billing & general help",
    icon: "headset",
    accent: "#c2410c",
    accentSoft: "rgba(194, 65, 12, 0.1)",
  },
];

const AI_GREETING = "Hi! I'm SkinnFit AI Assistant. How can I help you today?";

function visibleHomeRows(rows: HomeConversation[]): HomeConversation[] {
  return AI_CHATBOT_ENABLED ? rows : rows.filter((row) => row.id !== "ai");
}

function defaultHomeRows(): HomeConversation[] {
  return visibleHomeRows([
    {
      id: "ai",
      title: "Skin AI Assistant",
      subtitle: "Instant answers about skincare and scans.",
      unread: 0,
    },
    {
      id: "appointments",
      title: "Appointments",
      subtitle: "Schedule updates and reminders.",
      unread: 0,
    },
    {
      id: "support",
      title: "Clinic Team",
      subtitle: "Billing, logistics and support.",
      unread: 0,
    },
  ]);
}

function chatErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : "Something went wrong.";
}
const HOME_CACHE_KEY = "skinfit-chat-home-v2";
const CHAT_LAST_DOCTOR_KEY = "skinfit-chat-last-doctor-id";
const THREAD_CACHE_KEY_PREFIX = "skinfit-chat-thread-v1:";
const THREAD_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_STREAM_PATH = "/api/chat/plain/stream";
const CHAT_INBOX_STREAM_PATH = "/api/chat/plain/inbox-stream";
const MAX_CHAT_IMAGE_DATA_URI_LEN = 520_000;
const APPOINTMENT_KEYWORDS = [
  "appointment",
  "scheduled",
  "rescheduled",
  "confirmed",
  "clinic visit",
  "check-up",
  "consultation",
];

function formatMsgTime(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return null;
    return format(d, "h:mm a");
  } catch {
    return null;
  }
}

function normalizeApiMessages(rows: unknown): ChatMsg[] {
  if (!Array.isArray(rows)) return [];
  const out: ChatMsg[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : null;
    const text = typeof r.text === "string" ? r.text : "";
    const attachmentUrl =
      typeof r.attachmentUrl === "string" && r.attachmentUrl.trim()
        ? r.attachmentUrl.trim()
        : null;
    const sender = r.sender;
    if (sender !== "patient" && sender !== "doctor" && sender !== "support") continue;
    if (!id) continue;
    let createdAt: string | undefined;
    if (typeof r.createdAt === "string") createdAt = r.createdAt;
    else if (r.createdAt instanceof Date) createdAt = r.createdAt.toISOString();
    out.push({ id, sender, text, attachmentUrl, createdAt });
  }
  return out;
}

function parseChatAttachments(stored: string | null | undefined): string[] {
  if (!stored) return [];
  if (stored.startsWith("skinfit-chat-multi:")) {
    try {
      const parsed = JSON.parse(stored.slice("skinfit-chat-multi:".length)) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [stored];
}

function dataUriKind(uri: string | null | undefined): "image" | "audio" | "other" | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  return "other";
}

function dateLabelFromIso(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return undefined;
    return format(d, "d MMM");
  } catch {
    return undefined;
  }
}

function isAppointmentMessage(text: string): boolean {
  const t = text.toLowerCase();
  return APPOINTMENT_KEYWORDS.some((word) => t.includes(word));
}

function threadCacheKey(assistantId: AssistantId, doctorId?: string | null): string {
  if (assistantId === "doctor" && doctorId) {
    return `${THREAD_CACHE_KEY_PREFIX}doctor:${doctorId}`;
  }
  return `${THREAD_CACHE_KEY_PREFIX}${assistantId}`;
}

export default function ChatScreen() {
  const { token } = useAuth();
  const routeParams = useLocalSearchParams<{ doctorId?: string }>();
  const routeDoctorId = useMemo(() => {
    const raw = routeParams.doctorId;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [routeParams.doctorId]);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const [homeMode, setHomeMode] = useState(true);
  const [homeLoading, setHomeLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [registeredDoctors, setRegisteredDoctors] = useState<RegisteredDoctor[]>([]);
  const [activeDoctorId, setActiveDoctorId] = useState<string | null>(null);
  const [doctorChatEnabled, setDoctorChatEnabled] = useState(true);
  const [doctorChatDisabledMessage, setDoctorChatDisabledMessage] = useState(
    DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE
  );
  const [doctorUnread, setDoctorUnread] = useState(0);
  const [homeRows, setHomeRows] = useState<HomeConversation[]>(defaultHomeRows);
  const [active, setActive] = useState<AssistantId>(DEFAULT_PATIENT_CHAT_ASSISTANT);
  const [threadScope, setThreadScope] = useState<ThreadScope>("all");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingThread, setRefreshingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosText, setSosText] = useState("");
  const [sosImageUri, setSosImageUri] = useState<string | null>(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    dataUri: string;
    fileName: string;
  } | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const peer = useMemo(() => {
    return (
      CONTACTS.find((c) => c.id === active) ??
      CONTACTS.find((c) => c.id === DEFAULT_PATIENT_CHAT_ASSISTANT) ??
      CONTACTS[0]!
    );
  }, [active]);

  const activeDoctorProfile = useMemo((): DoctorProfile => {
    const doctor = registeredDoctors.find((d) => d.id === activeDoctorId);
    if (!doctor) {
      return {
        name: "",
        subtitle: "",
        replyHint: "Typically replies in a few hours",
        avatarUrl: undefined,
      };
    }
    return {
      name: doctor.name,
      subtitle: doctor.specialty || "Care Team",
      replyHint: "Typically replies in a few hours",
      avatarUrl: doctor.imageUrl,
    };
  }, [registeredDoctors, activeDoctorId]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (!AI_CHATBOT_ENABLED && active === "ai") {
      setActive(DEFAULT_PATIENT_CHAT_ASSISTANT);
      setHomeMode(true);
    }
  }, [active]);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages, scrollToEnd]);

  useEffect(() => {
    setPendingImage(null);
  }, [active, activeDoctorId, homeMode]);

  const fetchPlainMessages = useCallback(
    async (assistantId: AssistantId, doctorId?: string | null) => {
      if (!token) {
        return { messages: [] as ChatMsg[], clinicReadThroughIso: undefined as string | undefined };
      }
      if (assistantId === "doctor" && !doctorId) {
        return { messages: [] as ChatMsg[], clinicReadThroughIso: undefined as string | undefined };
      }
      let url = `/api/chat/plain/messages?assistantId=${encodeURIComponent(assistantId)}`;
      if (assistantId === "doctor" && doctorId) {
        url += `&doctorId=${encodeURIComponent(doctorId)}`;
      }
      const data = await apiJson<{
        success?: boolean;
        messages?: ChatMsg[];
        clinicReadThroughIso?: string;
      }>(url, token, { method: "GET" });
      if (!data.success) throw new Error("Failed to load messages.");
      const messages = mapDisplayChatMessages(normalizeApiMessages(data.messages));
      return {
        messages,
        clinicReadThroughIso: data.clinicReadThroughIso,
      };
    },
    [token]
  );

  const createPlainThread = useCallback(
    async (assistantId: AssistantId, doctorId?: string | null) => {
      if (!token) throw new Error("Not signed in.");
      const data = await apiJson<{ success?: boolean; threadId?: string; error?: string }>(
        "/api/chat/plain/thread",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            assistantId,
            ...(assistantId === "doctor" && doctorId ? { doctorId } : {}),
          }),
        }
      );
      if (!data.success || !data.threadId) {
        throw new Error(data.error || "Thread create failed.");
      }
      return data.threadId;
    },
    [token]
  );

  const seedAssistantGreeting = useCallback(
    async (assistantId: AssistantId, threadId: string, text: string) => {
      if (!token) return;
      await apiJson("/api/chat/plain/reply", token, {
        method: "POST",
        body: JSON.stringify({ assistantId, threadId, text }),
      });
    },
    [token]
  );

  const fetchAssistantReply = useCallback(
    async (args: {
      message: string;
      history: Array<{ role: "user" | "assistant"; content: string }>;
    }) => {
      if (!token) throw new Error("Not signed in.");
      const data = await apiJson<{ success?: boolean; reply?: string; error?: string }>(
        "/api/ai/chat",
        token,
        {
          method: "POST",
          body: JSON.stringify({
            assistantId: "ai",
            message: args.message,
            history: args.history,
          }),
        }
      );
      if (!data.success || !data.reply) {
        throw new Error(data.error || "AI request failed.");
      }
      return data.reply;
    },
    [token]
  );

  const persistThreadCache = useCallback(
    async (assistantId: AssistantId, rows: ChatMsg[], doctorId?: string | null) => {
      try {
        await AsyncStorage.setItem(
          threadCacheKey(assistantId, doctorId),
          JSON.stringify({ ts: Date.now(), rows: rows.slice(-120) })
        );
      } catch {
        /* ignore cache write failures */
      }
    },
    []
  );

  const readThreadCache = useCallback(
    async (
      assistantId: AssistantId,
      doctorId?: string | null
    ): Promise<{ rows: ChatMsg[]; stale: boolean }> => {
      try {
        const raw = await AsyncStorage.getItem(threadCacheKey(assistantId, doctorId));
        if (!raw) return { rows: [], stale: true };
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && "rows" in (parsed as Record<string, unknown>)) {
          const p = parsed as { rows?: unknown; ts?: number };
          const rows = normalizeApiMessages(p.rows ?? []);
          const stale = typeof p.ts === "number" ? Date.now() - p.ts > THREAD_CACHE_TTL_MS : true;
          return { rows, stale };
        }
        return { rows: normalizeApiMessages(parsed), stale: true };
      } catch {
        return { rows: [], stale: true };
      }
    },
    []
  );

  const loadHomeData = useCallback(async () => {
    if (!token) return;
    setHomeLoading(true);
    try {
      const [doctorSince, supportSince] = await Promise.all([
        getDoctorInboxLastSeenIso(),
        getClinicSupportInboxLastSeenIso(),
      ]);
      const unreadQuery = new URLSearchParams({ doctorSince, supportSince });
      const [aiRes, supportRes, unreadRes, calendarRes, doctorsListRes, doctorProfileRes] =
        await Promise.allSettled([
          AI_CHATBOT_ENABLED
            ? fetchPlainMessages("ai")
            : Promise.resolve({ messages: [] as ChatMsg[] }),
          fetchPlainMessages("support"),
          apiJson<{
            doctorCount?: number;
            supportCount?: number;
            total?: number;
          }>(`/api/chat/inbox/unread?${unreadQuery.toString()}`, token, {
            method: "GET",
          }),
          apiJson<{
            events?: Array<{
              start?: string;
              doctor?: {
                id?: string | null;
                name?: string | null;
                email?: string | null;
                imageUrl?: string | null;
                specialty?: string | null;
              };
            }>;
          }>("/api/calendar/patient", token, { method: "GET" }),
          apiJson<{
            doctors?: Array<{ id?: string; name?: string; email?: string | null }>;
            doctorChatEnabled?: boolean;
            doctorChatDisabledMessage?: string | null;
          }>("/api/patient/doctors", token, { method: "GET" }),
          apiJson<{
            doctors?: Array<{
              id?: string;
              name?: string;
              imageUrl?: string | null;
              specialty?: string | null;
            }>;
          }>("/api/chat/doctor-profile", token, { method: "GET" }),
        ]);
      const aiPlain = aiRes.status === "fulfilled" ? aiRes.value : { messages: [] as ChatMsg[] };
      const supportPlain =
        supportRes.status === "fulfilled" ? supportRes.value : { messages: [] as ChatMsg[] };
      const unreadData =
        unreadRes.status === "fulfilled"
          ? unreadRes.value
          : ({ doctorCount: 0, supportCount: 0 } as const);
      const calendarData =
        calendarRes.status === "fulfilled"
          ? calendarRes.value
          : {
              events: [] as Array<{
                start?: string;
                doctor?: {
                  name?: string | null;
                  specialty?: string | null;
                  imageUrl?: string | null;
                };
              }>,
            };
      const doctorsListData =
        doctorsListRes.status === "fulfilled" ? doctorsListRes.value : { doctors: [] };
      if (doctorsListRes.status === "fulfilled") {
        setDoctorChatEnabled(doctorsListRes.value.doctorChatEnabled !== false);
        setDoctorChatDisabledMessage(
          typeof doctorsListRes.value.doctorChatDisabledMessage === "string"
            ? doctorsListRes.value.doctorChatDisabledMessage
            : DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE
        );
      }
      const doctorProfileData =
        doctorProfileRes.status === "fulfilled" ? doctorProfileRes.value : { doctors: [] };

      const profileById = new Map(
        (doctorProfileData.doctors ?? [])
          .filter((d) => d.id)
          .map((d) => [
            d.id!,
            {
              imageUrl: d.imageUrl?.trim() || undefined,
              specialty: d.specialty?.trim() || "",
            },
          ])
      );

      const baseDoctors = (doctorsListData.doctors ?? [])
        .filter((d) => d.id && (d.name ?? "").trim())
        .map((d) => ({
          id: d.id!,
          name: (d.name ?? "").trim(),
          specialty: profileById.get(d.id!)?.specialty ?? "",
          imageUrl: profileById.get(d.id!)?.imageUrl,
        }));

      const doctorPreviewRows = await Promise.all(
        baseDoctors.map(async (d) => {
          try {
            const plain = await fetchPlainMessages("doctor", d.id);
            const last = plain.messages.at(-1);
            const lastClinic = [...plain.messages]
              .reverse()
              .find((m) => m.sender === "doctor" || m.sender === "support");
            return {
              ...d,
              lastMessage: last?.text || "No messages yet",
              lastMessageAt: last?.createdAt,
              hasUnreadClinicMessage: (() => {
                if (!lastClinic?.createdAt) return false;
                const msgMs = Date.parse(lastClinic.createdAt);
                const sinceMs = Date.parse(doctorSince);
                if (Number.isNaN(msgMs) || Number.isNaN(sinceMs)) return false;
                return msgMs > sinceMs + 1000;
              })(),
            };
          } catch {
            return {
              ...d,
              lastMessage: "No messages yet",
              lastMessageAt: undefined,
              hasUnreadClinicMessage: false,
            };
          }
        })
      );

      const apiDoctorUnread = Math.max(0, unreadData.doctorCount || 0);
      const previewDoctorUnread = doctorPreviewRows.filter((d) => d.hasUnreadClinicMessage).length;
      const doctorUnread = Math.max(apiDoctorUnread, previewDoctorUnread);
      const supportUnread = Math.max(0, unreadData.supportCount || 0);
      const aiUnread = 0;

      setSupplementalDoctorUnread(Math.max(0, doctorUnread - apiDoctorUnread));

      const nextAppointment = calendarData.events?.find((e) => !!e.start);
      const nextAppointmentLabel = nextAppointment?.start
        ? `Next appointment on ${dateLabelFromIso(nextAppointment.start) || "upcoming date"}`
        : "No upcoming appointment reminders";

      setRegisteredDoctors(doctorPreviewRows);
      setDoctorUnread(doctorUnread);

      const aiLast = aiPlain.messages.at(-1);
      const supportLast = supportPlain.messages.at(-1);
      const appointmentsLast = [...supportPlain.messages]
        .reverse()
        .find((m) => m.sender !== "patient" && isAppointmentMessage(m.text));

      const nextHomeRows: HomeConversation[] = visibleHomeRows([
        {
          id: "ai",
          title: "Skin AI Assistant",
          subtitle: aiLast?.text || "No messages yet",
          unread: aiUnread,
          dateLabel: dateLabelFromIso(aiLast?.createdAt),
        },
        {
          id: "appointments",
          title: "Appointments",
          subtitle: appointmentsLast?.text || nextAppointmentLabel,
          unread: 0,
          dateLabel:
            dateLabelFromIso(appointmentsLast?.createdAt) ||
            dateLabelFromIso(nextAppointment?.start),
        },
        {
          id: "support",
          title: "Clinic Team",
          subtitle: supportLast?.text || "No messages yet",
          unread: supportUnread,
          dateLabel: dateLabelFromIso(supportLast?.createdAt),
        },
      ]);
      setHomeRows(nextHomeRows);
      void AsyncStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({
          registeredDoctors: doctorPreviewRows,
          homeRows: nextHomeRows,
          doctorUnread,
        })
      ).catch(() => {
        /* ignore cache write failures */
      });
      notifyInboxUnreadChanged();
    } catch {
      // Keep previously rendered rows/profile if refresh fails, avoid blank previews.
    } finally {
      setHomeLoading(false);
    }
  }, [token, fetchPlainMessages]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as {
          registeredDoctors?: RegisteredDoctor[];
          homeRows?: HomeConversation[];
          doctorUnread?: number;
        };
        if (Array.isArray(parsed.registeredDoctors) && parsed.registeredDoctors.length > 0) {
          setRegisteredDoctors(parsed.registeredDoctors);
        }
        if (typeof parsed.doctorUnread === "number") {
          setDoctorUnread(parsed.doctorUnread);
        }
        if (Array.isArray(parsed.homeRows) && parsed.homeRows.length > 0) {
          setHomeRows(visibleHomeRows(parsed.homeRows));
        }
        setHomeLoading(false);
      } catch {
        /* ignore cache parse failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiJson<{
          doctorChatEnabled?: boolean;
          doctorChatDisabledMessage?: string | null;
        }>("/api/patient/doctors", token, { method: "GET" });
        if (cancelled) return;
        setDoctorChatEnabled(data.doctorChatEnabled !== false);
        setDoctorChatDisabledMessage(
          typeof data.doctorChatDisabledMessage === "string"
            ? data.doctorChatDisabledMessage
            : DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE
        );
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!homeMode || !token) return;

    let cancelled = false;

    void loadHomeData();

    let pollMs = 15_000;
    let pollTimer = setInterval(() => void loadHomeData(), pollMs);

    const restartPoll = (ms: number) => {
      pollMs = ms;
      clearInterval(pollTimer);
      pollTimer = setInterval(() => void loadHomeData(), pollMs);
    };

    const disconnect = connectChatSseStream({
      path: CHAT_INBOX_STREAM_PATH,
      token,
      onEvent: (data) => {
        if (cancelled) return;
        if (data.type === "ping") return;
        if (
          data.type === "inbox_updated" ||
          data.type === "thread_updated" ||
          data.type === "connected"
        ) {
          restartPoll(15_000);
          void loadHomeData();
        }
      },
      onUnavailable: () => {
        if (!cancelled) restartPoll(6_000);
      },
    });

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      disconnect();
    };
  }, [homeMode, token, loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      if (homeMode) void loadHomeData();
    }, [homeMode, loadHomeData])
  );

  useEffect(() => {
    if (!routeDoctorId) return;
    setHomeMode(false);
    setActive("doctor");
    setThreadScope("all");
    setActiveDoctorId(routeDoctorId);
    void AsyncStorage.setItem(CHAT_LAST_DOCTOR_KEY, routeDoctorId).catch(() => undefined);
  }, [routeDoctorId]);

  useEffect(() => {
    if (active !== "doctor" || activeDoctorId || routeDoctorId) return;
    if (registeredDoctors.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const last = await AsyncStorage.getItem(CHAT_LAST_DOCTOR_KEY);
        const pick =
          last && registeredDoctors.some((d) => d.id === last)
            ? last
            : registeredDoctors[0]!.id;
        if (!cancelled) setActiveDoctorId(pick);
      } catch {
        if (!cancelled) setActiveDoctorId(registeredDoctors[0]!.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, activeDoctorId, registeredDoctors, routeDoctorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || homeMode) return;
      if (active === "doctor" && !activeDoctorId) {
        setMessages([]);
        setLoading(false);
        return;
      }
      setError(null);
      const cached = await readThreadCache(
        active,
        active === "doctor" ? activeDoctorId : undefined
      );
      if (cancelled) return;
      if (cached.rows.length > 0) {
        setMessages(cached.rows);
        setLoading(cached.stale);
      } else {
        setMessages([]);
        setLoading(true);
      }
      try {
        if (active === "ai") {
          let plain = await fetchPlainMessages("ai");
          if (cancelled) return;
          if (plain.messages.length === 0) {
            const threadId = await createPlainThread("ai");
            await seedAssistantGreeting("ai", threadId, AI_GREETING);
            plain = await fetchPlainMessages("ai");
          }
          if (cancelled) return;
          setMessages(plain.messages);
          void persistThreadCache("ai", plain.messages);
        } else {
          const plain = await fetchPlainMessages(
            active,
            active === "doctor" ? activeDoctorId : undefined
          );
          if (cancelled) return;
          setMessages(plain.messages);
          void persistThreadCache(
            active,
            plain.messages,
            active === "doctor" ? activeDoctorId : undefined
          );
          if (active === "support") {
            await markClinicSupportInboxSeenFromServer(plain.clinicReadThroughIso);
          } else if (active === "doctor") {
            await markDoctorInboxSeenFromServer(plain.clinicReadThroughIso);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    homeMode,
    active,
    activeDoctorId,
    token,
    fetchPlainMessages,
    createPlainThread,
    seedAssistantGreeting,
    readThreadCache,
    persistThreadCache,
  ]);

  useEffect(() => {
    if (homeMode || !token || active === "ai") return;
    if (active === "doctor" && !activeDoctorId) return;

    let cancelled = false;

    async function syncThread(markRead: boolean) {
      if (cancelled) return;
      try {
        const refreshed = await fetchPlainMessages(
          active,
          active === "doctor" ? activeDoctorId : undefined
        );
        if (cancelled) return;
        setMessages(refreshed.messages);
        void persistThreadCache(
          active,
          refreshed.messages,
          active === "doctor" ? activeDoctorId : undefined
        );
        if (markRead) {
          if (active === "support") {
            await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
          } else if (active === "doctor") {
            await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
          }
        }
      } catch {
        /* no-op */
      }
    }

    void syncThread(true);

    // Backup poll — RN fetch SSE can appear connected but never deliver chunks.
    let pollMs = 4_000;
    let pollTimer = setInterval(() => void syncThread(true), pollMs);

    const restartPoll = (ms: number) => {
      pollMs = ms;
      clearInterval(pollTimer);
      pollTimer = setInterval(() => void syncThread(true), pollMs);
    };

    const q = new URLSearchParams({ assistantId: active });
    if (active === "doctor" && activeDoctorId) {
      q.set("doctorId", activeDoctorId);
    }

    const disconnect = connectChatSseStream({
      path: `${CHAT_STREAM_PATH}?${q.toString()}`,
      token,
      onEvent: (data) => {
        if (cancelled) return;
        if (data.type === "ping") return;
        if (data.type === "thread_updated" || data.type === "connected") {
          restartPoll(4_000);
          void syncThread(true);
        }
      },
      onUnavailable: () => {
        if (!cancelled) restartPoll(6_000);
      },
    });

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      disconnect();
    };
  }, [
    homeMode,
    token,
    active,
    activeDoctorId,
    fetchPlainMessages,
    persistThreadCache,
  ]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const stale = keys.filter((k) => {
          if (!k.startsWith(THREAD_CACHE_KEY_PREFIX)) return false;
          if (active === "doctor") {
            return k !== threadCacheKey("doctor", activeDoctorId);
          }
          return k !== threadCacheKey(active);
        });
        if (stale.length > 0) {
          await AsyncStorage.multiRemove(stale);
        }
      } catch {
        /* ignore cache cleanup failures */
      }
    })();
  }, [token, active, activeDoctorId]);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone access", "Please allow microphone access to record voice notes.");
        return;
      }
      await configureRecordingAudioMode();
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordSec(0);
      recordTimer.current = setInterval(() => setRecordSec((s) => s + 1), 1000);
    } catch {
      Alert.alert("Error", "Could not start recording.");
    }
  }

  async function stopAndSendRecording() {
    if (!recording || !token) return;
    if (recordTimer.current) clearInterval(recordTimer.current);
    setIsRecording(false);
    setLoading(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordSec(0);
      if (!uri) throw new Error("No recording URI");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const audioDataUri = `data:audio/m4a;base64,${base64}`;

      const caption = input.trim();
      await apiJson("/api/chat/plain/message", token, {
        method: "POST",
        body: JSON.stringify({
          assistantId: active,
          text: caption || undefined,
          attachmentUrl: audioDataUri,
          ...(active === "doctor" && activeDoctorId ? { doctorId: activeDoctorId } : {}),
        }),
      });
      setInput("");
      const refreshed = await fetchPlainMessages(
        active,
        active === "doctor" ? activeDoctorId : undefined
      );
      setMessages(refreshed.messages);
      void persistThreadCache(
        active,
        refreshed.messages,
        active === "doctor" ? activeDoctorId : undefined
      );
      if (active === "support") {
        await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
      } else if (active === "doctor") {
        await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
      }
    } catch (e) {
      setError(chatErrorMessage(e));
    } finally {
      setLoading(false);
      void configurePlaybackAudioMode();
    }
  }

  async function cancelRecording() {
    if (!recording) return;
    if (recordTimer.current) clearInterval(recordTimer.current);
    try {
      await recording.stopAndUnloadAsync();
    } catch { /* ignore */ }
    setRecording(null);
    setIsRecording(false);
    setRecordSec(0);
    void configurePlaybackAudioMode();
  }

  async function pickChatImage() {
    if (active === "ai") {
      Alert.alert("Photos", "Photo attachments are available in doctor and clinic chats.");
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos", "Allow photo library access to attach an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.55,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;

      const base64 =
        asset.base64 ??
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));
      const mime = asset.mimeType?.startsWith("image/")
        ? asset.mimeType
        : "image/jpeg";
      const dataUri = `data:${mime};base64,${base64}`;
      if (dataUri.length > MAX_CHAT_IMAGE_DATA_URI_LEN) {
        Alert.alert("Image too large", "Please choose a smaller photo or screenshot.");
        return;
      }
      setPendingImage({
        uri: asset.uri,
        dataUri,
        fileName: asset.fileName || "photo.jpg",
      });
      setError(null);
    } catch {
      Alert.alert("Photos", "Could not attach this image. Try another photo.");
    }
  }

  function formatRecordTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function send() {
    const text = input.trim();
    const attachmentUrl = active === "ai" ? null : pendingImage?.dataUri ?? null;
    if ((!text && !attachmentUrl) || loading || !token) return;
    Keyboard.dismiss();
    setError(null);

    if (active === "ai") {
      const patientMsg: ChatMsg = {
        id: `p-${Date.now()}`,
        sender: "patient",
        text,
      };
      const next = [...messages, patientMsg];
      const history = next.slice(-10).map((m) => ({
        role: m.sender === "patient" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        const store = await apiJson<{ success?: boolean; threadId?: string; error?: string }>(
          "/api/chat/plain/message",
          token,
          {
            method: "POST",
            body: JSON.stringify({ assistantId: "ai", text }),
          }
        );
        if (!store.success || !store.threadId) {
          throw new Error(store.error || "Could not store message.");
        }
        const reply = await fetchAssistantReply({ message: text, history });
        await seedAssistantGreeting("ai", store.threadId, reply);
        const refreshed = await fetchPlainMessages("ai");
        setMessages(refreshed.messages);
        void persistThreadCache("ai", refreshed.messages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const optimisticMsg: ChatMsg = {
      id: `p-${Date.now()}`,
      sender: "patient",
      text: text || "Image",
      attachmentUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    try {
      await apiJson("/api/chat/plain/message", token, {
        method: "POST",
        body: JSON.stringify({
          assistantId: active,
          text,
          ...(attachmentUrl ? { attachmentUrl } : {}),
          ...(active === "doctor" && activeDoctorId ? { doctorId: activeDoctorId } : {}),
        }),
      });
      const refreshed = await fetchPlainMessages(
        active,
        active === "doctor" ? activeDoctorId : undefined
      );
      setMessages(refreshed.messages);
      void persistThreadCache(
        active,
        refreshed.messages,
        active === "doctor" ? activeDoctorId : undefined
      );
      if (active === "support") {
        await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
      } else if (active === "doctor") {
        await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
      }
    } catch (e) {
      setPendingImage(
        attachmentUrl
          ? { uri: attachmentUrl, dataUri: attachmentUrl, fileName: "photo.jpg" }
          : null
      );
      setError(chatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function clearView() {
    if (active !== "support" && active !== "doctor") return;
    Alert.alert(
      "Clear view",
      "Hide messages on your side? The clinic still has the full history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setLoading(true);
            try {
              await apiJson("/api/chat/plain/clear-view", token, {
                method: "POST",
                body: JSON.stringify({
                  assistantId: active,
                  ...(active === "doctor" && activeDoctorId ? { doctorId: activeDoctorId } : {}),
                }),
              });
              const refreshed = await fetchPlainMessages(
                active,
                active === "doctor" ? activeDoctorId : undefined
              );
              setMessages(refreshed.messages);
              void persistThreadCache(
                active,
                refreshed.messages,
                active === "doctor" ? activeDoctorId : undefined
              );
              if (active === "support") {
                await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
              } else if (active === "doctor") {
                await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Clear failed.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const doctorChatBlocked = active === "doctor" && !doctorChatEnabled;
  const openClinicSupport = useCallback(() => {
    setHomeMode(false);
    setActive("support");
    setThreadScope("all");
  }, []);
  const canSend =
    !loading &&
    !doctorChatBlocked &&
    (input.trim().length > 0 || (active !== "ai" && pendingImage != null));
  const threadMessages =
    threadScope === "appointments"
      ? messages.filter((m) => m.sender === "patient" || isAppointmentMessage(m.text))
      : messages;
  const activeThreadTitle =
    threadScope === "appointments"
      ? "Appointments"
      : active === "doctor"
        ? activeDoctorProfile.name || CONTACTS[1]?.name || "Doctor"
        : peer.name;
  const activeThreadSubtitle =
    threadScope === "appointments"
      ? "Appointment updates and confirmations"
      : active === "doctor"
        ? activeDoctorProfile.subtitle || "Online"
        : "Online";
  const headerAvatarIconName: keyof typeof Ionicons.glyphMap =
    threadScope === "appointments"
      ? "calendar"
      : active === "ai"
        ? "sparkles"
        : active === "support"
          ? "people"
          : "person";
  const headerAvatarBg =
    threadScope === "appointments"
      ? "#e7f4ec"
      : active === "support"
        ? "#e6effa"
        : active === "ai"
          ? "#e7f4ec"
          : "#e2e8f0";

  const laterIncomingIndexById = new Map<string, boolean>();
  for (let i = 0; i < threadMessages.length; i += 1) {
    const msg = threadMessages[i];
    if (msg.sender !== "patient") continue;
    let seen = false;
    for (let j = i + 1; j < threadMessages.length; j += 1) {
      if (threadMessages[j]?.sender !== "patient") {
        seen = true;
        break;
      }
    }
    laterIncomingIndexById.set(msg.id, seen);
  }
  const filteredDoctors = registeredDoctors.filter((doctor) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      doctor.name.toLowerCase().includes(q) ||
      doctor.specialty.toLowerCase().includes(q) ||
      (doctor.lastMessage ?? "").toLowerCase().includes(q)
    );
  });
  const filteredRows = visibleHomeRows(homeRows).filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return row.title.toLowerCase().includes(q) || row.subtitle.toLowerCase().includes(q);
  });

  function goToChatHome() {
    setHomeMode(true);
    setActive(DEFAULT_PATIENT_CHAT_ASSISTANT);
  }

  function openDoctorThread(doctorId: string) {
    setActiveDoctorId(doctorId);
    void AsyncStorage.setItem(CHAT_LAST_DOCTOR_KEY, doctorId).catch(() => undefined);
    setActive("doctor");
    setThreadScope("all");
    setHomeMode(false);
  }

  function openHomeThread(id: HomeThreadId) {
    if (id === "ai" && !AI_CHATBOT_ENABLED) return;
    if (id === "appointments") {
      setActive("support");
      setThreadScope("appointments");
      setHomeMode(false);
      return;
    }
    setThreadScope("all");
    setActive(id);
    setHomeMode(false);
  }

  if (homeMode) {
    return (
      <SafeAreaView style={[styles.flex, styles.safeHome]} edges={["top"]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.homeWrap,
            { paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.homeHeader}>
            <Text style={styles.homeTitle}>Chat</Text>
            <NotificationBell />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#9aa4b2" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages or doctors"
              placeholderTextColor="#9aa4b2"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <Text style={styles.recentTitle}>Your Doctors</Text>
          {filteredDoctors.length === 0 ? (
            <View style={styles.emptyDoctorsCard}>
              <Text style={styles.emptyDoctorsText}>
                {homeLoading ? "Loading doctors…" : "No clinic doctors registered yet."}
              </Text>
            </View>
          ) : (
            filteredDoctors.map((doctor) => (
              <Pressable
                key={doctor.id}
                style={styles.primaryCard}
                onPress={() => openDoctorThread(doctor.id)}
              >
                <View style={styles.primaryAvatar}>
                  {doctor.imageUrl ? (
                    <Image source={{ uri: doctor.imageUrl }} style={styles.primaryAvatarImage} />
                  ) : (
                    <Ionicons name="person" size={24} color="#475569" />
                  )}
                </View>
                <View style={styles.primaryInfo}>
                  <Text style={styles.primaryName} numberOfLines={1}>
                    {doctor.name}
                  </Text>
                  <Text style={styles.primarySpec} numberOfLines={1}>
                    {doctor.specialty || "Care Team"}
                  </Text>
                  <View style={styles.primaryPill}>
                    <Text style={styles.primaryPillText}>Doctor Chat</Text>
                  </View>
                  <Text style={styles.primaryHint} numberOfLines={2}>
                    {doctor.lastMessage || "No messages yet"}
                  </Text>
                </View>
                <View style={styles.primaryTrailing}>
                  {doctor.lastMessageAt ? (
                    <Text style={styles.rowDate}>{dateLabelFromIso(doctor.lastMessageAt)}</Text>
                  ) : null}
                  {doctor.hasUnreadClinicMessage || doctorUnread > 0 ? (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadDotText}>
                        {doctorUnread > 9 ? "9+" : Math.max(1, doctorUnread)}
                      </Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={24} color={ZINC_900} />
                </View>
              </Pressable>
            ))
          )}

          <Text style={styles.recentTitle}>Recent Conversations</Text>

          <View style={styles.listCard}>
            {filteredRows.map((row, idx) => (
              <Pressable
                key={row.id}
                style={[styles.homeRow, idx < filteredRows.length - 1 && styles.homeRowBorder]}
                onPress={() => openHomeThread(row.id)}
              >
                <View style={styles.rowAvatar}>
                  <Ionicons
                    name={
                      row.id === "ai"
                        ? "sparkles"
                        : row.id === "appointments"
                          ? "calendar"
                          : "people"
                    }
                    size={16}
                    color="#6b7280"
                  />
                </View>
                <View style={styles.rowMain}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {row.title}
                    </Text>
                    {row.dateLabel ? <Text style={styles.rowDate}>{row.dateLabel}</Text> : null}
                  </View>
                  <Text style={styles.rowSub} numberOfLines={2}>
                    {row.subtitle}
                  </Text>
                </View>
                {row.unread > 0 ? (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadDotText}>{row.unread > 9 ? "9+" : row.unread}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, styles.safeThread]} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
      >
        <View style={[styles.wrap, { paddingTop: 4, paddingBottom: Math.max(insets.bottom, 86) }]}>
        <View style={styles.threadHeader}>
          <Pressable style={styles.backIconBtn} onPress={goToChatHome} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={ZINC_900} />
          </Pressable>
          <View style={styles.threadIdentity}>
            <View style={[styles.threadAvatar, { backgroundColor: headerAvatarBg }]}>
              {active === "doctor" && activeDoctorProfile.avatarUrl ? (
                <Image source={{ uri: activeDoctorProfile.avatarUrl }} style={styles.threadAvatarImage} />
              ) : (
                <Ionicons name={headerAvatarIconName} size={18} color="#475569" />
              )}
            </View>
            <View style={styles.threadMeta}>
              <Text style={styles.threadName} numberOfLines={1}>
                {activeThreadTitle}
              </Text>
              <Text style={styles.threadStatus}>{activeThreadSubtitle}</Text>
            </View>
          </View>
          <View style={styles.threadBellWrap}>
            <NotificationBell />
          </View>
        </View>

        {active === "doctor" && doctorChatEnabled ? (
          <Pressable
            style={styles.sosBtn}
            onPress={() => {
              setSosText("");
              setSosImageUri(null);
              setSosOpen(true);
            }}
          >
            <Ionicons name="warning" size={18} color="#fff" />
            <Text style={styles.sosBtnText}>SOS</Text>
          </Pressable>
        ) : null}

        <Modal visible={sosOpen} animationType="slide" transparent>
          <View style={styles.sosBackdrop}>
            <View style={styles.sosSheet}>
              <Text style={styles.sosTitle}>SOS — contact doctors</Text>
              <Text style={styles.sosSub}>
                Describe any reaction or urgent concern. We&apos;ll attach your last visits and latest
                scan summary for the clinical team.
              </Text>
              <TextInput
                style={styles.sosInput}
                placeholder="What happened?"
                placeholderTextColor="#94a3b8"
                multiline
                value={sosText}
                onChangeText={setSosText}
              />
              {sosImageUri ? (
                <Image source={{ uri: sosImageUri }} style={styles.sosThumb} />
              ) : null}
              <View style={styles.sosActions}>
                <Pressable
                  style={styles.sosSecondary}
                  onPress={async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) return;
                    const r = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.6,
                    });
                    if (!r.canceled && r.assets[0]?.uri) setSosImageUri(r.assets[0].uri);
                  }}
                >
                  <Text style={styles.sosSecondaryText}>Add photo</Text>
                </Pressable>
                <Pressable
                  style={styles.sosSecondary}
                  onPress={() => {
                    setSosOpen(false);
                    setSosBusy(false);
                  }}
                >
                  <Text style={styles.sosSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.sosPrimary, sosBusy && { opacity: 0.6 }]}
                  disabled={sosBusy || !sosText.trim()}
                  onPress={async () => {
                    if (!token || !sosText.trim() || !activeDoctorId) return;
                    setSosBusy(true);
                    try {
                      let attachmentUrl: string | undefined;
                      if (sosImageUri) {
                        const b64 = await FileSystem.readAsStringAsync(sosImageUri, {
                          encoding: "base64",
                        });
                        attachmentUrl = `data:image/jpeg;base64,${b64}`.slice(0, 450_000);
                      }
                      await apiJson("/api/chat/plain/message", token, {
                        method: "POST",
                        body: JSON.stringify({
                          assistantId: "doctor",
                          doctorId: activeDoctorId,
                          text: sosText.trim(),
                          isUrgent: true,
                          attachmentUrl,
                        }),
                      });
                      const refreshed = await fetchPlainMessages("doctor", activeDoctorId);
                      setMessages(refreshed.messages);
                      void persistThreadCache("doctor", refreshed.messages, activeDoctorId);
                      await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
                      setSosOpen(false);
                      setSosText("");
                      setSosImageUri(null);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "SOS send failed.");
                    } finally {
                      setSosBusy(false);
                    }
                  }}
                >
                  <Text style={styles.sosPrimaryText}>{sosBusy ? "Sending…" : "Send SOS"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable onPress={() => setError(null)} hitSlop={12}>
              <Ionicons name="close" size={20} color="#64748b" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listWrap}>
          {loading && messages.length === 0 ? (
            <View style={styles.loaderBlock}>
              <ActivityIndicator size="large" color={TEAL} />
              <Text style={styles.loaderLabel}>Loading conversation…</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.list}
              data={threadMessages}
              keyExtractor={(m) => m.id}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
              refreshing={refreshingThread}
              onRefresh={async () => {
                setRefreshingThread(true);
                try {
                  const refreshed = await fetchPlainMessages(
                    active,
                    active === "doctor" ? activeDoctorId : undefined
                  );
                  setMessages(refreshed.messages);
                  void persistThreadCache(
                    active,
                    refreshed.messages,
                    active === "doctor" ? activeDoctorId : undefined
                  );
                  if (active === "support") {
                    await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
                  } else if (active === "doctor") {
                    await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
                  }
                } finally {
                  setRefreshingThread(false);
                }
              }}
              ListEmptyComponent={
                doctorChatBlocked ? (
                  <DoctorChatClinicVisitGate
                    variant="empty"
                    message={doctorChatDisabledMessage}
                    onSupportPress={openClinicSupport}
                  />
                ) : (
                  <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="chatbubbles-outline" size={30} color={TEAL} />
                    </View>
                    <Text style={styles.emptyTitle}>No messages yet</Text>
                    <Text style={styles.emptySub}>Type below to start the conversation.</Text>
                  </View>
                )
              }
              contentContainerStyle={[
                styles.listContent,
                threadMessages.length === 0 && styles.listContentEmpty,
              ]}
              renderItem={({ item }) => {
                const isPatient = item.sender === "patient";
                const t = formatMsgTime(item.createdAt);
                const seen = !!laterIncomingIndexById.get(item.id);
                const incomingAvatarBg =
                  threadScope === "appointments"
                    ? "#e7f4ec"
                    : item.sender === "doctor"
                      ? "#e2e8f0"
                      : active === "support"
                        ? "#e6effa"
                        : "#e7f4ec";
                return (
                  <View style={[styles.msgRow, isPatient ? styles.msgRowPatient : styles.msgRowOther]}>
                    {!isPatient ? (
                      <View style={[styles.msgAvatar, { backgroundColor: incomingAvatarBg }]}>
                        {item.sender === "doctor" && activeDoctorProfile.avatarUrl ? (
                          <Image source={{ uri: activeDoctorProfile.avatarUrl }} style={styles.msgAvatarImage} />
                        ) : (
                          <Ionicons
                            name={
                              threadScope === "appointments"
                                ? "calendar"
                                : item.sender === "doctor"
                                  ? "person"
                                  : active === "ai"
                                    ? "sparkles"
                                    : active === "support"
                                      ? "people"
                                      : "chatbubble-ellipses"
                            }
                            size={14}
                            color="#475569"
                          />
                        )}
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.bubble,
                        isPatient ? styles.bubblePatient : styles.bubbleOther,
                      ]}
                    >
                      {parseChatAttachments(item.attachmentUrl).map((uri, idx) =>
                        dataUriKind(uri) === "image" ? (
                          <Image
                            key={`${item.id}-image-${idx}`}
                            source={{ uri }}
                            style={styles.messageImage}
                            resizeMode="cover"
                          />
                        ) : dataUriKind(uri) === "audio" ? (
                          <View key={`${item.id}-audio-${idx}`} style={styles.audioPill}>
                            <Ionicons
                              name="mic"
                              size={14}
                              color={isPatient ? NAVY : "#64748b"}
                            />
                            <Text
                              style={[
                                styles.audioPillText,
                                isPatient ? styles.audioPillTextPatient : null,
                              ]}
                            >
                              Voice note
                            </Text>
                          </View>
                        ) : null
                      )}
                      {item.text.trim() ? (
                        <ChatMessageMarkdown
                          text={item.text}
                          variant={isPatient ? "patient" : "incoming"}
                        />
                      ) : null}
                      <View style={styles.metaRow}>
                        {t ? (
                          <Text style={[styles.ts, isPatient ? styles.tsPatient : styles.tsOther]}>{t}</Text>
                        ) : null}
                        {isPatient ? (
                          <Ionicons
                            name={seen ? "checkmark-done" : "checkmark"}
                            size={16}
                            color={NAVY}
                            style={styles.tickIcon}
                          />
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {(active === "support" || active === "doctor") && threadMessages.length > 0 ? (
          <Pressable style={styles.clearBtn} onPress={clearView} hitSlop={8}>
            <Ionicons name="eye-off-outline" size={16} color="#64748b" />
            <Text style={styles.clearBtnText}>Clear my view</Text>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.composer,
            doctorChatBlocked && threadMessages.length > 0 ? styles.composerGateOnly : null,
          ]}
        >
          {doctorChatBlocked ? (
            threadMessages.length > 0 ? (
              <DoctorChatClinicVisitGate
                variant="composer"
                message={doctorChatDisabledMessage}
                onSupportPress={openClinicSupport}
              />
            ) : null
          ) : isRecording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTimer}>{formatRecordTime(recordSec)}</Text>
              <Text style={styles.recordingLabel}>Recording…</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={cancelRecording} style={styles.recordCancelBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color="#ef4444" />
              </Pressable>
              <Pressable onPress={stopAndSendRecording} style={styles.recordSendBtn} hitSlop={8}>
                <Ionicons name="send" size={17} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <>
              {pendingImage && active !== "ai" ? (
                <View style={styles.pendingImageCard}>
                  <Image source={{ uri: pendingImage.uri }} style={styles.pendingImageThumb} />
                  <View style={styles.pendingImageMeta}>
                    <Text style={styles.pendingImageTitle} numberOfLines={1}>
                      Photo attached
                    </Text>
                    <Text style={styles.pendingImageName} numberOfLines={1}>
                      {pendingImage.fileName}
                    </Text>
                  </View>
                  <Pressable
                    onPress={pickChatImage}
                    style={styles.pendingImageAction}
                    disabled={loading}
                    hitSlop={8}
                  >
                    <Text style={styles.pendingImageActionText}>Change</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPendingImage(null)}
                    style={styles.pendingImageRemove}
                    disabled={loading}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color="#64748b" />
                  </Pressable>
                </View>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="Write a message…"
                placeholderTextColor="#94a3b8"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={4000}
                editable={!loading}
              />
              {active !== "ai" ? (
                <Pressable
                  style={styles.imageFab}
                  onPress={pickChatImage}
                  disabled={loading}
                  accessibilityLabel={pendingImage ? "Change attached photo" : "Attach photo"}
                >
                  <Ionicons name="image-outline" size={20} color={NAVY} />
                </Pressable>
              ) : null}
              {active !== "ai" ? (
                <Pressable
                  style={styles.micFab}
                  onPress={startRecording}
                  disabled={loading}
                  accessibilityLabel="Record voice note"
                >
                  <Ionicons name="mic" size={20} color={NAVY} />
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.sendFab, (!canSend || loading) && styles.sendFabDisabled]}
                onPress={send}
                disabled={!canSend || loading}
                accessibilityLabel="Send message"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={17} color="#fff" style={{ marginLeft: 1 }} />
                )}
              </Pressable>
            </>
          )}
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeHome: { backgroundColor: CREAM },
  safeThread: { backgroundColor: "#f8fafc" },
  homeWrap: {
    flex: 1,
    backgroundColor: CREAM,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 12,
  },
  homeTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: ZINC_900,
    letterSpacing: -0.8,
  },
  searchWrap: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7ebef",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: ZINC_900, paddingVertical: 0 },
  primaryCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e7ebef",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryAvatar: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#cfd4dc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryAvatarImage: { width: "100%", height: "100%" },
  primaryInfo: { flex: 1, minWidth: 0 },
  primaryName: { fontSize: 20, fontWeight: "700", color: ZINC_900 },
  primarySpec: { marginTop: 2, fontSize: 13, color: "#4b5563", fontWeight: "500" },
  primaryPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#d8f0e1",
    borderRadius: 11,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  primaryPillText: { fontSize: 12, color: "#2e7d4e", fontWeight: "600" },
  primaryHint: { marginTop: 8, fontSize: 12, color: "#4b5563", lineHeight: 16 },
  primaryTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  emptyDoctorsCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e7ebef",
    padding: 16,
  },
  emptyDoctorsText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  recentTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 19,
    fontWeight: "700",
    color: ZINC_900,
  },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e7ebef",
    overflow: "hidden",
  },
  homeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  homeRowBorder: { borderBottomWidth: 1, borderBottomColor: "#eef2f6" },
  rowAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e7f4ec",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rowAvatarImage: { width: "100%", height: "100%" },
  rowAvatarDoctor: { backgroundColor: "#eceef8" },
  rowMain: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "700", color: ZINC_900 },
  rowDate: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  rowSub: { marginTop: 2, fontSize: 13, color: "#6b7280", lineHeight: 18 },
  unreadDot: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadDotText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  wrap: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 12,
    gap: 10,
  },
  backIconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  threadBellWrap: {
    minWidth: 36,
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 2,
  },
  threadIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  threadAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  threadAvatarImage: { width: "100%", height: "100%" },
  threadMeta: { flex: 1, minWidth: 0 },
  threadName: { fontSize: 24, fontWeight: "700", color: ZINC_900 },
  threadStatus: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  msgAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    marginRight: 8,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  msgAvatarImage: { width: "100%", height: "100%" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorBannerText: { flex: 1, color: "#991b1b", fontSize: 13, lineHeight: 18 },
  listWrap: {
    flex: 1,
    minHeight: 160,
    zIndex: 0,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eef2f7",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  list: { flex: 1 },
  loaderBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
    gap: 12,
  },
  loaderLabel: { fontSize: 14, color: "#64748b" },
  listContent: { paddingTop: 4, paddingBottom: 12 },
  listContentEmpty: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: ZINC_900 },
  emptySub: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 6, lineHeight: 20 },
  msgRow: { marginBottom: 14, maxWidth: "100%" },
  msgRowPatient: { alignSelf: "flex-end", alignItems: "flex-end", flexDirection: "row" },
  msgRowOther: { alignSelf: "flex-start", alignItems: "flex-start", flexDirection: "row" },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePatient: {
    backgroundColor: "#d9dce8",
    borderRadius: 20,
    borderBottomRightRadius: 8,
    shadowColor: "#9ca3af",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  metaRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  ts: { fontSize: 11 },
  tsPatient: { color: "#6b7280", alignSelf: "flex-end", fontWeight: "600" },
  tsOther: { color: "#94a3b8" },
  tickIcon: { marginTop: 1 },
  messageImage: {
    width: 190,
    height: 190,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "#e2e8f0",
  },
  audioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  audioPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  audioPillTextPatient: {
    color: NAVY,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  clearBtnText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  composer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
    marginTop: 8,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    flexShrink: 0,
  },
  composerGateOnly: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingTop: 0,
  },
  pendingImageCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe5ef",
    backgroundColor: "#fff",
    padding: 8,
  },
  pendingImageThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  pendingImageMeta: {
    flex: 1,
    minWidth: 0,
  },
  pendingImageTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: ZINC_900,
  },
  pendingImageName: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  pendingImageAction: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e7f4ec",
  },
  pendingImageActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: NAVY,
  },
  pendingImageRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    color: ZINC_900,
  },
  sendFab: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
  },
  sosBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  sosBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  sosBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sosSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  sosTitle: { fontSize: 18, fontWeight: "800", color: ZINC_900 },
  sosSub: { fontSize: 13, color: "#64748b", marginTop: 8, lineHeight: 18 },
  sosInput: {
    marginTop: 12,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  sosThumb: { width: "100%", height: 140, borderRadius: 12, marginTop: 10 },
  sosActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  sosSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  sosSecondaryText: { fontWeight: "700", color: "#475569" },
  sosPrimary: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  sosPrimaryText: { color: "#fff", fontWeight: "800" },
  sendFabDisabled: { opacity: 0.45, shadowOpacity: 0 },
  micFab: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  imageFab: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  recordingTimer: {
    fontSize: 16,
    fontWeight: "800",
    color: "#b91c1c",
    fontVariant: ["tabular-nums"] as any,
  },
  recordingLabel: {
    fontSize: 13,
    color: "#991b1b",
    fontWeight: "600",
  },
  recordCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  recordSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
});
