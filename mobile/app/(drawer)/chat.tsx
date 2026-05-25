import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
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
import { useMobileDoctorChatE2ee } from "@/hooks/useMobileDoctorChatE2ee";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
  markClinicSupportInboxSeenFromServer,
  markDoctorInboxSeenFromServer,
} from "@/lib/inboxReadCursors";

type AssistantId = "ai" | "doctor" | "support";
type HomeThreadId = AssistantId | "appointments";
type ThreadScope = "all" | "appointments";

/** API + DB use patient | doctor | support (AI assistant rows use sender "support"). */
type ChatSender = "patient" | "doctor" | "support";

type ChatMsg = {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt?: string;
};

type HomeConversation = {
  id: HomeThreadId;
  title: string;
  subtitle: string;
  unread: number;
  dateLabel?: string;
};

type DoctorProfile = {
  name: string;
  subtitle: string;
  replyHint: string;
  avatarUrl?: string;
};

const TEAL = "#0d9488";
const CREAM = "#dfe7dc";
const ZINC_900 = "#18181b";
const NAVY = "#23286f";

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

function chatErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.body.error === "E2EE_REQUIRED") {
      return typeof e.body.message === "string"
        ? e.body.message
        : "Secure chat is active. Wait for encryption to finish, then send again.";
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}
const HOME_CACHE_KEY = "skinfit-chat-home-v1";
const THREAD_CACHE_KEY_PREFIX = "skinfit-chat-thread-v1:";
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
    const sender = r.sender;
    if (sender !== "patient" && sender !== "doctor" && sender !== "support") continue;
    if (!id) continue;
    let createdAt: string | undefined;
    if (typeof r.createdAt === "string") createdAt = r.createdAt;
    else if (r.createdAt instanceof Date) createdAt = r.createdAt.toISOString();
    out.push({ id, sender, text, createdAt });
  }
  return out;
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

function threadCacheKey(assistantId: AssistantId): string {
  return `${THREAD_CACHE_KEY_PREFIX}${assistantId}`;
}

export default function ChatScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const [homeMode, setHomeMode] = useState(true);
  const [homeLoading, setHomeLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>({
    name: "",
    subtitle: "",
    replyHint: "",
    avatarUrl: undefined,
  });
  const [homeRows, setHomeRows] = useState<HomeConversation[]>([
    {
      id: "doctor",
      title: "Doctor",
      subtitle: "Your dermatologist replies here.",
      unread: 0,
    },
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
  const [active, setActive] = useState<AssistantId>("ai");
  const [threadScope, setThreadScope] = useState<ThreadScope>("all");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosText, setSosText] = useState("");
  const [sosImageUri, setSosImageUri] = useState<string | null>(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasDoctorE2eeReadyRef = useRef(false);

  const peer = useMemo(() => CONTACTS.find((c) => c.id === active)!, [active]);

  const doctorE2ee = useMobileDoctorChatE2ee(token, !homeMode && active === "doctor");
  const {
    e2eeFeatureEnabled: doctorE2eeFeatureOn,
    e2eeReady: doctorE2eeReady,
    e2eeStatus: doctorE2eeStatus,
    decryptMessages: decryptDoctorMessages,
    encryptOutgoingText: encryptDoctorOutgoing,
    ensureReadyForSend: ensureDoctorE2eeForSend,
    retryE2eeSetup: retryDoctorE2ee,
  } = doctorE2ee;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages, scrollToEnd]);

  const fetchPlainMessages = useCallback(
    async (assistantId: AssistantId) => {
      if (!token) return { messages: [] as ChatMsg[], clinicReadThroughIso: undefined as string | undefined };
      const data = await apiJson<{
        success?: boolean;
        messages?: ChatMsg[];
        clinicReadThroughIso?: string;
      }>(
        `/api/chat/plain/messages?assistantId=${encodeURIComponent(assistantId)}`,
        token,
        { method: "GET" }
      );
      if (!data.success) throw new Error("Failed to load messages.");
      let messages = normalizeApiMessages(data.messages);
      if (assistantId === "doctor") {
        messages = await decryptDoctorMessages(messages);
      }
      return {
        messages,
        clinicReadThroughIso: data.clinicReadThroughIso,
      };
    },
    [token, ensureDoctorE2eeForSend, decryptDoctorMessages]
  );

  const createPlainThread = useCallback(
    async (assistantId: AssistantId) => {
      if (!token) throw new Error("Not signed in.");
      const data = await apiJson<{ success?: boolean; threadId?: string; error?: string }>(
        "/api/chat/plain/thread",
        token,
        {
          method: "POST",
          body: JSON.stringify({ assistantId }),
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

  const persistThreadCache = useCallback(async (assistantId: AssistantId, rows: ChatMsg[]) => {
    try {
      await AsyncStorage.setItem(threadCacheKey(assistantId), JSON.stringify(rows.slice(-120)));
    } catch {
      /* ignore cache write failures */
    }
  }, []);

  const readThreadCache = useCallback(async (assistantId: AssistantId): Promise<ChatMsg[]> => {
    try {
      const raw = await AsyncStorage.getItem(threadCacheKey(assistantId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return normalizeApiMessages(parsed);
    } catch {
      return [];
    }
  }, []);

  /** Re-decrypt after E2EE boots (messages often load from cache first). */
  useEffect(() => {
    if (homeMode || active !== "doctor" || !doctorE2eeFeatureOn) {
      wasDoctorE2eeReadyRef.current = false;
      return;
    }
    const justReady = doctorE2eeReady && !wasDoctorE2eeReadyRef.current;
    wasDoctorE2eeReadyRef.current = doctorE2eeReady;
    if (!justReady) return;

    let cancelled = false;
    void (async () => {
      try {
        const plain = await fetchPlainMessages("doctor");
        if (cancelled) return;
        setMessages(plain.messages);
        void persistThreadCache("doctor", plain.messages);
      } catch {
        /* keep cached messages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doctorE2eeReady, doctorE2eeFeatureOn, active, homeMode, fetchPlainMessages, persistThreadCache]);

  const loadHomeData = useCallback(async () => {
    if (!token) return;
    setHomeLoading(true);
    try {
      const [doctorSince, supportSince] = await Promise.all([
        getDoctorInboxLastSeenIso(),
        getClinicSupportInboxLastSeenIso(),
      ]);
      const unreadQuery = new URLSearchParams({ doctorSince, supportSince });
      const [aiRes, doctorRes, supportRes, unreadRes, calendarRes, doctorProfileRes] =
        await Promise.allSettled([
        fetchPlainMessages("ai"),
        fetchPlainMessages("doctor"),
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
          profile?: {
            name?: string | null;
            specialty?: string | null;
            imageUrl?: string | null;
          } | null;
        }>("/api/chat/doctor-profile", token, { method: "GET" }),
      ]);
      const aiPlain = aiRes.status === "fulfilled" ? aiRes.value : { messages: [] as ChatMsg[] };
      const doctorPlain = doctorRes.status === "fulfilled" ? doctorRes.value : { messages: [] as ChatMsg[] };
      const supportPlain = supportRes.status === "fulfilled" ? supportRes.value : { messages: [] as ChatMsg[] };
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
      const doctorProfileData =
        doctorProfileRes.status === "fulfilled" ? doctorProfileRes.value : { profile: null };

      const doctorUnread = Math.max(0, unreadData.doctorCount || 0);
      const supportUnread = Math.max(0, unreadData.supportCount || 0);
      const aiUnread = 0;

      const profileName = doctorProfileData.profile?.name?.trim() || "";
      const nextAppointment = calendarData.events?.find((e) => !!e.start);
      const nextAppointmentLabel = nextAppointment?.start
        ? `Next appointment on ${dateLabelFromIso(nextAppointment.start) || "upcoming date"}`
        : "No upcoming appointment reminders";

      const nextDoctorProfile = {
        name: profileName,
        subtitle: doctorProfileData.profile?.specialty?.trim() || "",
        replyHint: "Typically replies in a few hours",
        avatarUrl: doctorProfileData.profile?.imageUrl?.trim() || undefined,
      };
      setDoctorProfile(nextDoctorProfile);

      const aiLast = aiPlain.messages.at(-1);
      const doctorLast = doctorPlain.messages.at(-1);
      const supportLast = supportPlain.messages.at(-1);
      const appointmentsLast = [...supportPlain.messages]
        .reverse()
        .find((m) => m.sender !== "patient" && isAppointmentMessage(m.text));

      const nextHomeRows: HomeConversation[] = [
        {
          id: "doctor",
          title: profileName || "Doctor",
          subtitle: doctorLast?.text || "No messages yet",
          unread: doctorUnread,
          dateLabel: dateLabelFromIso(doctorLast?.createdAt),
        },
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
        }
      ];
      setHomeRows(nextHomeRows);
      void AsyncStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({
          doctorProfile: nextDoctorProfile,
          homeRows: nextHomeRows,
        })
      ).catch(() => {
        /* ignore cache write failures */
      });
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
          doctorProfile?: { name?: string; subtitle?: string; replyHint?: string; avatarUrl?: string };
          homeRows?: HomeConversation[];
        };
        if (parsed.doctorProfile) {
          setDoctorProfile({
            name: parsed.doctorProfile.name || "",
            subtitle: parsed.doctorProfile.subtitle || "",
            replyHint: parsed.doctorProfile.replyHint || "",
            avatarUrl: parsed.doctorProfile.avatarUrl || undefined,
          });
        }
        if (Array.isArray(parsed.homeRows) && parsed.homeRows.length > 0) {
          setHomeRows(parsed.homeRows);
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
    void (async () => {
      if (!token) return;
      try {
        await apiJson("/api/appointments/reminders/tick", token, { method: "POST" });
      } catch {
        /* optional */
      }
    })();
  }, [token]);

  useEffect(() => {
    if (homeMode) {
      void loadHomeData();
    }
  }, [homeMode, loadHomeData]);

  useEffect(() => {
    if (!homeMode) return;
    const id = setInterval(() => {
      void loadHomeData();
    }, 20_000);
    return () => clearInterval(id);
  }, [homeMode, loadHomeData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      setError(null);
      const cached = await readThreadCache(active);
      if (cancelled) return;
      if (cached.length > 0) {
        setMessages(cached);
        setLoading(false);
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
          const plain = await fetchPlainMessages(active);
          if (cancelled) return;
          setMessages(plain.messages);
          void persistThreadCache(active, plain.messages);
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
    active,
    token,
    fetchPlainMessages,
    createPlainThread,
    seedAssistantGreeting,
    readThreadCache,
    persistThreadCache,
  ]);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone access", "Please allow microphone access to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
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

      let caption = input.trim();
      if (active === "doctor" && caption && doctorE2eeFeatureOn) {
        const session = await ensureDoctorE2eeForSend();
        if (!session?.ready) {
          throw new Error(
            session?.status ??
              "Secure chat is not ready. Wait a few seconds, then try again."
          );
        }
        caption = await encryptDoctorOutgoing(caption);
      }
      await apiJson("/api/chat/plain/message", token, {
        method: "POST",
        body: JSON.stringify({
          assistantId: active,
          text: caption || undefined,
          attachmentUrl: audioDataUri,
        }),
      });
      setInput("");
      const refreshed = await fetchPlainMessages(active);
      setMessages(refreshed.messages);
      void persistThreadCache(active, refreshed.messages);
      if (active === "support") {
        await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
      } else if (active === "doctor") {
        await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
      }
    } catch (e) {
      setError(chatErrorMessage(e));
    } finally {
      setLoading(false);
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
  }

  function formatRecordTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !token) return;
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

    setLoading(true);
    try {
      let outbound = text;
      if (active === "doctor" && doctorE2eeFeatureOn) {
        const session = await ensureDoctorE2eeForSend();
        if (!session?.ready) {
          throw new Error(
            session?.status ??
              "Secure chat is not ready. Wait a few seconds, then try again."
          );
        }
        outbound = await encryptDoctorOutgoing(text);
      }
      await apiJson("/api/chat/plain/message", token, {
        method: "POST",
        body: JSON.stringify({ assistantId: active, text: outbound }),
      });
      const refreshed = await fetchPlainMessages(active);
      setMessages(refreshed.messages);
      void persistThreadCache(active, refreshed.messages);
      setInput("");
      if (active === "support") {
        await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
      } else if (active === "doctor") {
        await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
      }
    } catch (e) {
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
                body: JSON.stringify({ assistantId: active }),
              });
              const refreshed = await fetchPlainMessages(active);
              setMessages(refreshed.messages);
              void persistThreadCache(active, refreshed.messages);
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

  const canSend = input.trim().length > 0 && !loading;
  const threadMessages =
    threadScope === "appointments"
      ? messages.filter((m) => m.sender === "patient" || isAppointmentMessage(m.text))
      : messages;
  const activeThreadTitle =
    threadScope === "appointments"
      ? "Appointments"
      : active === "doctor"
        ? doctorProfile.name || CONTACTS[1]?.name || "Doctor"
        : peer.name;
  const activeThreadSubtitle =
    threadScope === "appointments" ? "Appointment updates and confirmations" : "Online";
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
  const filteredRows = homeRows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return row.title.toLowerCase().includes(q) || row.subtitle.toLowerCase().includes(q);
  });

  function openHomeThread(id: HomeThreadId) {
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
        <View style={[styles.homeWrap, { paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.homeHeader}>
          <Text style={styles.homeTitle}>Chat</Text>
          <NotificationBell />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#9aa4b2" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages"
            placeholderTextColor="#9aa4b2"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <Pressable style={styles.primaryCard} onPress={() => openHomeThread("doctor")}>
          <View style={styles.primaryAvatar}>
            {doctorProfile.avatarUrl ? (
              <Image source={{ uri: doctorProfile.avatarUrl }} style={styles.primaryAvatarImage} />
            ) : (
              <Ionicons name="person" size={24} color="#475569" />
            )}
          </View>
          <View style={styles.primaryInfo}>
            <Text style={styles.primaryName} numberOfLines={1}>
              {doctorProfile.name || "Doctor"}
            </Text>
            <Text style={styles.primarySpec} numberOfLines={1}>
              {doctorProfile.subtitle || "Care Team"}
            </Text>
            <View style={styles.primaryPill}>
              <Text style={styles.primaryPillText}>Doctor Chat</Text>
            </View>
            <Text style={styles.primaryHint}>
              {doctorProfile.replyHint || "Typically replies in a few hours"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={ZINC_900} />
        </Pressable>

        <Text style={styles.recentTitle}>Recent Conversations</Text>

        <View style={styles.listCard}>
          {filteredRows.map((row, idx) => (
            <Pressable
              key={row.id}
              style={[styles.homeRow, idx < filteredRows.length - 1 && styles.homeRowBorder]}
              onPress={() => openHomeThread(row.id)}
            >
              <View style={[styles.rowAvatar, row.id === "doctor" && styles.rowAvatarDoctor]}>
                {row.id === "doctor" && doctorProfile.avatarUrl ? (
                  <Image source={{ uri: doctorProfile.avatarUrl }} style={styles.rowAvatarImage} />
                ) : (
                  <Ionicons
                    name={
                      row.id === "doctor"
                        ? "person"
                        : row.id === "ai"
                          ? "sparkles"
                          : row.id === "appointments"
                            ? "calendar"
                            : "people"
                    }
                    size={16}
                    color={row.id === "doctor" ? "#1f2a5a" : "#6b7280"}
                  />
                )}
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

        </View>
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
          <Pressable style={styles.backIconBtn} onPress={() => setHomeMode(true)} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={ZINC_900} />
          </Pressable>
          <View style={styles.threadIdentity}>
            <View style={[styles.threadAvatar, { backgroundColor: headerAvatarBg }]}>
              {active === "doctor" && doctorProfile.avatarUrl ? (
                <Image source={{ uri: doctorProfile.avatarUrl }} style={styles.threadAvatarImage} />
              ) : (
                <Ionicons name={headerAvatarIconName} size={18} color="#475569" />
              )}
            </View>
            <View style={styles.threadMeta}>
              <Text style={styles.threadName} numberOfLines={1}>
                {activeThreadTitle}
              </Text>
              {active === "doctor" && doctorE2eeFeatureOn && doctorE2eeStatus ? (
                <Pressable onPress={() => void retryDoctorE2ee()} hitSlop={6}>
                  <Text style={styles.threadStatus}>{doctorE2eeStatus} · Tap to retry</Text>
                </Pressable>
              ) : (
                <Text style={styles.threadStatus}>{activeThreadSubtitle}</Text>
              )}
              {active === "doctor" && doctorE2eeFeatureOn && doctorE2eeReady ? (
                <Text style={styles.e2eeBadge}>End-to-end encrypted</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.threadBellWrap}>
            <NotificationBell />
          </View>
        </View>

        {active === "doctor" ? (
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
                    if (!token || !sosText.trim()) return;
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
                          text: sosText.trim(),
                          isUrgent: true,
                          attachmentUrl,
                        }),
                      });
                      const refreshed = await fetchPlainMessages("doctor");
                      setMessages(refreshed.messages);
                      void persistThreadCache("doctor", refreshed.messages);
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
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="chatbubbles-outline" size={30} color={TEAL} />
                  </View>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptySub}>Type below to start the conversation.</Text>
                </View>
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
                        {item.sender === "doctor" && doctorProfile.avatarUrl ? (
                          <Image source={{ uri: doctorProfile.avatarUrl }} style={styles.msgAvatarImage} />
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
                      <ChatMessageMarkdown
                        text={item.text}
                        variant={isPatient ? "patient" : "incoming"}
                      />
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

        <View style={styles.composer}>
          {isRecording ? (
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
  e2eeBadge: { fontSize: 11, color: "#047857", marginTop: 2, fontWeight: "600" },
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
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
    marginTop: 8,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    flexShrink: 0,
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
