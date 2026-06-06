"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Search,
  Bot,
  User,
  Paperclip,
  Send,
  Eraser,
  Mic,
  X,
  Square,
  type LucideIcon,
} from "lucide-react";
import {
  CLINIC_SUPPORT_INBOX_EVENT,
  CLINIC_SUPPORT_INBOX_REFRESH_EVENT,
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
  markClinicSupportInboxSeenFromServer,
  markDoctorInboxSeenFromServer,
} from "@/src/lib/clinicSupportInboxClient";
import { GLOBAL_LIVE_REFRESH_EVENT } from "@/src/lib/globalRefreshEvents";
import { mapDisplayChatMessages } from "@/src/lib/chatE2ee/format";
import {
  AI_CHATBOT_ENABLED,
  DEFAULT_PATIENT_CHAT_ASSISTANT,
} from "@/src/lib/featureFlags";
import { DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE } from "@/src/lib/patientClinicVisit";
import {
  dataUriKind,
  MAX_CHAT_PENDING_ATTACHMENTS,
  parseChatAttachments,
  prepareChatAttachmentFromBlob,
  prepareChatAttachmentFromFile,
  type ChatPendingAttachment,
} from "@/src/lib/chatAttachments";

type AssistantId = "ai" | "doctor" | "support";

type SidebarContact = {
  key: string;
  kind: AssistantId;
  name: string;
  icon: LucideIcon;
  doctorId?: string;
};

const CARD_SHADOW = "rounded-[22px] border border-white/70 bg-white/35 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.04)]";

const MAX_RECORD_SECONDS = 120;

function formatMmSs(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChatPage() {
  type ChatMsg = {
    id: string;
    sender: AssistantId | "patient";
    text: string;
    attachmentUrl?: string | null;
    createdAt?: string;
  };

  const [activeAssistant, setActiveAssistant] = useState<AssistantId>(
    DEFAULT_PATIENT_CHAT_ASSISTANT
  );
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const AI_GREETING =
    "Hi! I'm SkinnFit AI Assistant. How can I help you today?";
  const [contactPreviews, setContactPreviews] = useState<
    Record<string, { snippet: string; time: string }>
  >({});
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingIndex, setTypingIndex] = useState(0);
  const [sidebarUnread, setSidebarUnread] = useState({ support: 0, doctor: 0 });
  const [registeredDoctors, setRegisteredDoctors] = useState<
    { id: string; name: string }[]
  >([]);
  const [activeDoctorId, setActiveDoctorId] = useState<string | null>(null);
  const [doctorChatEnabled, setDoctorChatEnabled] = useState(true);
  const [doctorChatDisabledMessage, setDoctorChatDisabledMessage] = useState(
    DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE
  );

  const doctorChatBlocked =
    activeAssistant === "doctor" && !doctorChatEnabled;

  const contacts = useMemo((): SidebarContact[] => {
    const doctorRows: SidebarContact[] = registeredDoctors.map((d) => ({
      key: `doctor:${d.id}`,
      kind: "doctor",
      name: d.name,
      icon: User,
      doctorId: d.id,
    }));
    return [
      ...(AI_CHATBOT_ENABLED
        ? [{ key: "ai", kind: "ai" as const, name: "SkinnFit AI Assistant", icon: Bot }]
        : []),
      ...doctorRows,
      { key: "support", kind: "support", name: "Clinic Support", icon: User },
    ];
  }, [registeredDoctors]);

  const isContactActive = useCallback(
    (contact: SidebarContact) => {
      if (contact.kind === "doctor") {
        return (
          activeAssistant === "doctor" && activeDoctorId === contact.doctorId
        );
      }
      return activeAssistant === contact.kind;
    },
    [activeAssistant, activeDoctorId]
  );
  const [attachments, setAttachments] = useState<ChatPendingAttachment[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeAssistantRef = useRef<AssistantId>(DEFAULT_PATIENT_CHAT_ASSISTANT);
  activeAssistantRef.current = activeAssistant;

  const messagesScrollRef = useRef<HTMLDivElement>(null);

  function messageDisplayText(msg: ChatMsg): string {
    return msg.text;
  }

  const scrollMessagesToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = messagesScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollMessagesToBottom();
  }, [
    messages,
    typingIndex,
    isLoading,
    error,
    activeAssistant,
    scrollMessagesToBottom,
  ]);

  const activeContact = useMemo(() => {
    const hit = contacts.find((c) => isContactActive(c));
    return hit ?? contacts[0]!;
  }, [contacts, isContactActive]);

  const fetchPlainMessages = useCallback(
    async (
      assistantId: AssistantId,
      doctorId?: string | null
    ): Promise<{ messages: ChatMsg[]; clinicReadThroughIso?: string }> => {
      if (assistantId === "doctor" && !doctorId) {
        return {
          messages: [],
          clinicReadThroughIso: new Date().toISOString(),
        };
      }

      let url = `/api/chat/plain/messages?assistantId=${encodeURIComponent(
        assistantId
      )}`;
      if (assistantId === "doctor" && doctorId) {
        url += `&doctorId=${encodeURIComponent(doctorId)}`;
      }

      const res = await fetch(url, { credentials: "include" });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        clinicReadThroughIso?: string;
        messages?: Array<{
          id: string;
          sender: AssistantId | "patient";
          text: string;
          attachmentUrl?: string | null;
          createdAt?: string;
        }>;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to fetch messages (${res.status})`);
      }

      const rows = data.messages ?? [];
      const messages = mapDisplayChatMessages(
        rows.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          attachmentUrl: m.attachmentUrl ?? null,
          createdAt: m.createdAt,
        }))
      );
      return {
        messages,
        clinicReadThroughIso: data.clinicReadThroughIso,
      };
    },
    []
  );

  const createPlainThread = useCallback(
    async (assistantId: AssistantId): Promise<string> => {
      const res = await fetch("/api/chat/plain/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assistantId }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        threadId?: string;
        error?: string;
      };

      if (!res.ok || !data.success || !data.threadId) {
        throw new Error(data.error || `Thread create failed (${res.status})`);
      }

      return data.threadId;
    },
    []
  );

  const seedAssistantGreeting = useCallback(
    async (assistantId: "ai" | "doctor" | "support", threadId: string, text: string) => {
      const res = await fetch("/api/chat/plain/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assistantId, threadId, text }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Greeting seed failed (${res.status})`);
      }
    },
    []
  );

  function truncate(s: string, max: number) {
    const t = s ?? "";
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function formatTimeLabel(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((now.getTime() - d.getTime()) / msPerDay);
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  /** Full date + time for each bubble (when the message was sent). */
  function formatMessageTimestamp(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const refreshSidebarUnread = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        supportSince: getClinicSupportInboxLastSeenIso(),
        doctorSince: getDoctorInboxLastSeenIso(),
      });
      const res = await fetch(`/api/chat/inbox/unread?${q.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as {
        success?: boolean;
        supportCount?: number;
        doctorCount?: number;
      };
      if (!res.ok || !data.success) return;
      setSidebarUnread({
        support: typeof data.supportCount === "number" ? data.supportCount : 0,
        doctor: typeof data.doctorCount === "number" ? data.doctorCount : 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshSidebarUnread();
    const t = setInterval(() => void refreshSidebarUnread(), 25_000);
    const onInbox = () => void refreshSidebarUnread();
    window.addEventListener(CLINIC_SUPPORT_INBOX_EVENT, onInbox);
    return () => {
      clearInterval(t);
      window.removeEventListener(CLINIC_SUPPORT_INBOX_EVENT, onInbox);
    };
  }, [refreshSidebarUnread]);

  const loadContactPreviews = useCallback(async () => {
    const next: Record<string, { snippet: string; time: string }> = {};

    const jobs: Array<() => Promise<void>> = [
      async () => {
        try {
          const { messages: plainMessages } = await fetchPlainMessages("ai");
          const last = plainMessages[plainMessages.length - 1];
          next.ai = last
            ? {
                snippet: truncate(last.text, 46),
                time: formatTimeLabel(last.createdAt),
              }
            : { snippet: "", time: "" };
        } catch {
          next.ai = { snippet: "", time: "" };
        }
      },
      async () => {
        try {
          const { messages: plainMessages } =
            await fetchPlainMessages("support");
          const last = plainMessages[plainMessages.length - 1];
          next.support = last
            ? {
                snippet: truncate(last.text, 46),
                time: formatTimeLabel(last.createdAt),
              }
            : { snippet: "", time: "" };
        } catch {
          next.support = { snippet: "", time: "" };
        }
      },
      ...registeredDoctors.map(
        (d) => async () => {
          const key = `doctor:${d.id}`;
          try {
            const { messages: plainMessages } = await fetchPlainMessages(
              "doctor",
              d.id
            );
            const last = plainMessages[plainMessages.length - 1];
            next[key] = last
              ? {
                  snippet: truncate(last.text, 46),
                  time: formatTimeLabel(last.createdAt),
                }
              : { snippet: "", time: "" };
          } catch {
            next[key] = { snippet: "", time: "" };
          }
        }
      ),
    ];

    await Promise.all(jobs.map((fn) => fn()));
    setContactPreviews(next);
  }, [fetchPlainMessages, registeredDoctors]);

  const clearClinicChatView = useCallback(async () => {
    const aid = activeAssistant;
    if (aid !== "support" && aid !== "doctor") return;
    if (
      !window.confirm(
        "Hide all messages in this chat on your side? Nothing is deleted — the clinic still has the full history. New messages will show up as usual."
      )
    ) {
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/plain/clear-view", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assistantId: aid,
          ...(aid === "doctor" && activeDoctorId
            ? { doctorId: activeDoctorId }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not clear view");
      }
      const { messages: next, clinicReadThroughIso } = await fetchPlainMessages(
        aid,
        aid === "doctor" ? activeDoctorId : undefined
      );
      setMessages(next);
      if (aid === "support") {
        markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
      }
      if (aid === "doctor") {
        markDoctorInboxSeenFromServer(clinicReadThroughIso);
      }
      void loadContactPreviews();
      void refreshSidebarUnread();
      window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear view");
    } finally {
      setIsLoading(false);
    }
  }, [
    activeAssistant,
    activeDoctorId,
    fetchPlainMessages,
    loadContactPreviews,
    refreshSidebarUnread,
  ]);

  // Typewriter effect for the latest assistant message (AI only).
  useEffect(() => {
    if (!typingMessageId) return;
    const msg = messages.find((m) => m.id === typingMessageId);
    if (!msg) return;
    setTypingIndex(0);

    const step = Math.max(1, Math.floor(msg.text.length / 120)); // smaller step = slower typing
    const interval = setInterval(() => {
      setTypingIndex((prev) => {
        const next = prev + step;
        if (next >= msg.text.length) {
          clearInterval(interval);
          setTypingMessageId(null);
          return msg.text.length;
        }
        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [typingMessageId, messages]);

  const fetchAssistantReply = useCallback(
    async (args: {
      assistantId: AssistantId;
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    }): Promise<string> => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assistantId: args.assistantId,
          message: args.message,
          history: args.history ?? [],
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reply?: string;
        error?: string;
      };

      if (!res.ok || !data.success || !data.reply) {
        throw new Error(data.error || `Chat request failed (${res.status})`);
      }

      return data.reply;
    },
    []
  );

  useEffect(() => {
    void loadContactPreviews();
  }, [loadContactPreviews]);

  useEffect(() => {
    const onGlobalRefresh = () => {
      void refreshSidebarUnread();
      void loadContactPreviews();
      if (activeAssistantRef.current === "ai") {
        void (async () => {
          try {
            const { messages: refreshed } = await fetchPlainMessages("ai");
            setMessages(refreshed);
          } catch {
            /* ignore */
          }
        })();
        return;
      }
      const plainId = activeAssistantRef.current;
      void (async () => {
        try {
          const { messages: refreshed, clinicReadThroughIso } =
            await fetchPlainMessages(plainId);
          setMessages(refreshed);
          if (plainId === "support") {
            markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
          }
          if (plainId === "doctor") {
            markDoctorInboxSeenFromServer(clinicReadThroughIso);
          }
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    return () =>
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
  }, [fetchPlainMessages, loadContactPreviews, refreshSidebarUnread]);

  /** Pre-visit reminders only run server-side unless something triggers them; chat is client-only. */
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/appointments/reminders/tick", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; sent?: number };
        if (data.ok && (data.sent ?? 0) > 0) {
          void loadContactPreviews();
          void refreshSidebarUnread();
          window.dispatchEvent(new Event(CLINIC_SUPPORT_INBOX_REFRESH_EVENT));
          if (activeAssistantRef.current === "support") {
            try {
              const { messages: plain, clinicReadThroughIso } =
                await fetchPlainMessages("support");
              setMessages(plain);
              markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [loadContactPreviews, refreshSidebarUnread, fetchPlainMessages]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/patient/doctors", {
          credentials: "include",
        });
        const data = (await res.json()) as {
          doctors?: Array<{ id?: string; name?: string }>;
          doctorChatEnabled?: boolean;
          doctorChatDisabledMessage?: string | null;
        };
        if (cancelled) return;
        const rows = (data.doctors ?? [])
          .filter((d) => d.id && (d.name ?? "").trim())
          .map((d) => ({
            id: d.id!,
            name: (d.name ?? "").trim(),
          }));
        setRegisteredDoctors(rows);
        setDoctorChatEnabled(data.doctorChatEnabled !== false);
        setDoctorChatDisabledMessage(
          typeof data.doctorChatDisabledMessage === "string"
            ? data.doctorChatDisabledMessage
            : DOCTOR_CHAT_REQUIRES_CLINIC_VISIT_MESSAGE
        );
      } catch {
        if (!cancelled) setRegisteredDoctors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!AI_CHATBOT_ENABLED && activeAssistant === "ai") {
      setActiveAssistant("support");
      setActiveDoctorId(null);
    }
  }, [activeAssistant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const a = params.get("assistant");
    const doctorId = params.get("doctorId");
    if (a === "support" || (a === "ai" && AI_CHATBOT_ENABLED)) {
      setActiveAssistant(a);
      setActiveDoctorId(null);
      return;
    }
    if (a === "ai" && !AI_CHATBOT_ENABLED) {
      setActiveAssistant("support");
      setActiveDoctorId(null);
      return;
    }
    if (a === "doctor") {
      setActiveAssistant("doctor");
      if (doctorId) setActiveDoctorId(doctorId);
    }
  }, []);

  useEffect(() => {
    if (activeAssistant !== "doctor") return;
    if (activeDoctorId) return;
    if (registeredDoctors.length === 0) return;
    setActiveDoctorId(registeredDoctors[0]!.id);
  }, [activeAssistant, activeDoctorId, registeredDoctors]);

  useEffect(() => {
    let cancelled = false;

    async function loadAiThread() {
      setError(null);
      setIsLoading(true);
      setMessages([]);
      try {
        const { messages: plainMessages } = await fetchPlainMessages("ai");
        if (cancelled) return;

        if (plainMessages.length === 0) {
          const threadId = await createPlainThread("ai");
          if (cancelled) return;

          // Seed fixed first message into DB.
          await seedAssistantGreeting("ai", threadId, AI_GREETING);
          if (cancelled) return;

          const { messages: seeded } = await fetchPlainMessages("ai");
          if (cancelled) return;

          setMessages(seeded);
          const lastAssistant = [...seeded]
            .reverse()
            .find((m) => m.sender !== "patient");
          if (lastAssistant) {
            setTypingMessageId(lastAssistant.id);
          }
        } else {
          setMessages(plainMessages);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load AI chat.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadPlain() {
      if (activeAssistant === "doctor" && !activeDoctorId) {
        setMessages([]);
        setIsLoading(false);
        return;
      }
      setError(null);
      setIsLoading(true);
      setMessages([]);
      try {
        const { messages: plainMessages, clinicReadThroughIso } =
          await fetchPlainMessages(
            activeAssistant,
            activeAssistant === "doctor" ? activeDoctorId : undefined
          );
        if (cancelled) return;
        setMessages(plainMessages);
        setAttachments([]);
        if (activeAssistant === "support") {
          markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
        }
        if (activeAssistant === "doctor") {
          markDoctorInboxSeenFromServer(clinicReadThroughIso);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load messages.");
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    }

    if (activeAssistant === "ai") {
      void loadAiThread();
    } else {
      void loadPlain();
    }
    return () => {
      cancelled = true;
    };
  }, [
    activeAssistant,
    activeDoctorId,
    fetchAssistantReply,
    fetchPlainMessages,
    createPlainThread,
    seedAssistantGreeting,
    AI_GREETING,
  ]);

  /**
   * Doctor / Clinic Support: live updates via Redis pub/sub + SSE (no 3.5s polling).
   */
  useEffect(() => {
    if (activeAssistant !== "doctor" && activeAssistant !== "support") return;

    let cancelled = false;
    let lastFingerprint: string | null = null;

    async function syncPlainThread(force = false) {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        !force
      ) {
        return;
      }
      try {
        if (activeAssistant === "doctor" && !activeDoctorId) return;
        const { messages: next, clinicReadThroughIso } =
          await fetchPlainMessages(
            activeAssistant,
            activeAssistant === "doctor" ? activeDoctorId : undefined
          );
        if (cancelled) return;
        const fp = next.map((m) => m.id).join(",");
        if (!force && lastFingerprint !== null && fp === lastFingerprint) return;
        lastFingerprint = fp;
        setMessages(next);
        if (activeAssistant === "support") {
          markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
        }
        if (activeAssistant === "doctor") {
          markDoctorInboxSeenFromServer(clinicReadThroughIso);
        }
        void loadContactPreviews();
      } catch {
        /* ignore */
      }
    }

    const q = new URLSearchParams({ assistantId: activeAssistant });
    if (activeAssistant === "doctor" && activeDoctorId) {
      q.set("doctorId", activeDoctorId);
    }
    const es = new EventSource(`/api/chat/plain/stream?${q.toString()}`);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type?: string };
        if (data.type === "thread_updated" || data.type === "connected") {
          void syncPlainThread(true);
        }
      } catch {
        void syncPlainThread(true);
      }
    };

    es.onerror = () => {
      es.close();
    };

    const onVisible = () => void syncPlainThread();
    const onInboxRefresh = () => void syncPlainThread(true);
    const onGlobalRefresh = () => void syncPlainThread(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, onInboxRefresh);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    void syncPlainThread();

    return () => {
      cancelled = true;
      es.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, onInboxRefresh);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    };
  }, [activeAssistant, activeDoctorId, fetchPlainMessages, loadContactPreviews]);

  const stopRecordStream = useCallback(() => {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopRecordStream();
      if (recordTickRef.current) clearInterval(recordTickRef.current);
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== "inactive") {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [stopRecordStream]);

  useEffect(() => {
    setAttachments([]);
    setComposerError(null);
  }, [activeAssistant, activeDoctorId]);

  const addAttachmentFiles = useCallback(async (files: File[]) => {
    if (activeAssistant === "ai") {
      setComposerError("Attachments are only available in Doctor and Clinic Support chats.");
      return;
    }
    if (files.length === 0) return;

    const next: ChatPendingAttachment[] = [];
    for (const file of files) {
      try {
        next.push(await prepareChatAttachmentFromFile(file));
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "ONLY_IMAGE_OR_AUDIO") {
          setComposerError("Only image or audio files are supported.");
        } else if (code === "IMAGE_TOO_LARGE" || code === "AUDIO_TOO_LARGE") {
          setComposerError(`${file.name} is too large. Try a smaller image or shorter clip.`);
        } else {
          setComposerError("Could not read attachment. Try JPG or PNG.");
        }
      }
    }
    if (next.length === 0) return;

    setAttachments((prev) => {
      const merged = [...prev, ...next].slice(0, MAX_CHAT_PENDING_ATTACHMENTS);
      if (prev.length + next.length > MAX_CHAT_PENDING_ATTACHMENTS) {
        setComposerError(`Only ${MAX_CHAT_PENDING_ATTACHMENTS} files per message.`);
      } else {
        setComposerError(null);
      }
      return merged;
    });
  }, [activeAssistant]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const startRecording = useCallback(async () => {
    if (isLoading || isRecording) return;
    if (activeAssistant === "ai") {
      setError("Voice notes are only available in Doctor and Clinic Support chats.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not available in this browser.");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];

      const preferred =
        MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
              ? "audio/webm"
              : "";

      const recorder = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopRecordStream();
        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        recordChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        if (recordTickRef.current) {
          clearInterval(recordTickRef.current);
          recordTickRef.current = null;
        }
        setRecordElapsed(0);
        if (blob.size < 800) {
          setError("Recording too short — try again.");
          return;
        }
        void (async () => {
          try {
            const pending = await prepareChatAttachmentFromBlob(
              blob,
              `voice-note-${Date.now()}.wav`
            );
            setAttachments((prev) => {
              if (prev.length >= MAX_CHAT_PENDING_ATTACHMENTS) {
                setError(`Only ${MAX_CHAT_PENDING_ATTACHMENTS} files per message.`);
                return prev;
              }
              return [...prev, pending];
            });
          } catch {
            setError("Could not process voice note.");
          }
        })();
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordElapsed(0);
      recordTickRef.current = setInterval(() => {
        setRecordElapsed((sec) => {
          const next = sec + 1;
          if (next >= MAX_RECORD_SECONDS) {
            if (recordTickRef.current) clearInterval(recordTickRef.current);
            recordTickRef.current = null;
            const mr = mediaRecorderRef.current;
            if (mr && mr.state === "recording") mr.stop();
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Allow microphone access to record a voice note.");
    }
  }, [activeAssistant, isLoading, isRecording, stopRecordStream]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  async function sendMessage() {
    const text = inputValue.trim();
    if (isLoading) return;

    setError(null);

    // LLM assistant chat (AI only for SkinnFit AI Assistant).
    if (activeAssistant === "ai") {
      if (!text) return;
      const patientMsg: ChatMsg = {
        id: crypto.randomUUID(),
        sender: "patient",
        text,
      };
      const nextMessages = [...messages, patientMsg];

      const history = nextMessages.slice(-10).map((m) => ({
        role: m.sender === "patient" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      // Optimistic UI: show the patient's message immediately (no waiting for DB/LLM).
      setMessages(nextMessages);
      setInputValue("");
      setIsLoading(true);
      try {
        // 1) Store patient message in DB (so it survives refresh/logout).
        const storeRes = await fetch("/api/chat/plain/message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assistantId: "ai", text }),
        });

        const storeData = (await storeRes.json()) as {
          success?: boolean;
          threadId?: string;
          error?: string;
        };

        if (!storeRes.ok || !storeData.success || !storeData.threadId) {
          throw new Error(storeData.error || `Failed to store message (${storeRes.status})`);
        }

        // 2) Call AI using current conversation history.
        const reply = await fetchAssistantReply({
          assistantId: "ai",
          message: text,
          history,
        });

        // 3) Store AI reply in DB.
        await seedAssistantGreeting("ai", storeData.threadId, reply);

        // 4) Reload from DB to ensure correct ordering/contents.
        const { messages: refreshed } = await fetchPlainMessages("ai");
        setMessages(refreshed);
        const lastAssistant = [...refreshed]
          .reverse()
          .find((m) => m.sender !== "patient");
        if (lastAssistant) {
          setTypingMessageId(lastAssistant.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!text && attachments.length === 0) return;

    const attachmentUrls = attachments.map((a) => a.dataUri);

    // Plain stored chat for Dr Ruby / Clinic Support (no AI replies).
    setIsLoading(true);
    try {
      if (activeAssistant === "doctor" && !activeDoctorId) {
        throw new Error("Select a doctor from the list to start chatting.");
      }
      const res = await fetch("/api/chat/plain/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assistantId: activeAssistant,
          ...(activeAssistant === "doctor" && activeDoctorId
            ? { doctorId: activeDoctorId }
            : {}),
          text,
          ...(attachmentUrls.length > 1
            ? { attachmentUrls }
            : attachmentUrls.length === 1
              ? { attachmentUrl: attachmentUrls[0] }
              : {}),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(
          data.message || data.error || `Failed to send message (${res.status})`
        );
      }

      const { messages: refreshed, clinicReadThroughIso } =
        await fetchPlainMessages(
          activeAssistant,
          activeAssistant === "doctor" ? activeDoctorId : undefined
        );
      setMessages(refreshed);
      if (activeAssistant === "support") {
        markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
      }
      if (activeAssistant === "doctor") {
        markDoctorInboxSeenFromServer(clinicReadThroughIso);
      }
      setInputValue("");
      setAttachments([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex min-h-[calc(100vh-120px)] flex-col gap-4 md:h-[calc(100vh-100px)] md:flex-row md:gap-6"
    >
      {/* Sidebar */}
      <div
        className={`flex w-full min-w-0 flex-col overflow-hidden md:w-[min(100%,320px)] md:shrink-0 ${CARD_SHADOW}`}
      >
        <div className="border-b border-white/40 p-4">
          <h1 className="mb-3 text-center text-xl font-extrabold text-[#2C3E6B] md:hidden">
            Chat
          </h1>
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/30 px-4 py-2.5 backdrop-blur-sm">
            <Search className="h-4 w-4 shrink-0 text-[#2C3E6B]/50" />
            <input
              type="text"
              placeholder="Search messages or doctors..."
              className="w-full bg-transparent text-sm text-[#2C3E6B] placeholder:text-[#2C3E6B]/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[240px] flex-1 overflow-y-auto md:max-h-none">
          {registeredDoctors.length === 0 ? (
            <p className="border-b border-white/40 px-4 py-3 text-center text-xs text-[#6B7280]">
              No clinic doctors registered yet.
            </p>
          ) : null}
          {contacts.map((contact) => {
            const Icon = contact.icon;
            const unreadN =
              contact.kind === "support"
                ? sidebarUnread.support
                : contact.kind === "doctor"
                  ? sidebarUnread.doctor
                  : 0;
            const preview = contactPreviews[contact.key];
            return (
              <div
                key={contact.key}
                className={`flex cursor-pointer items-center gap-3 border-b border-white/40 px-4 py-4 transition-colors hover:bg-white/40 ${
                  isContactActive(contact) ? "bg-white/30" : ""
                }`}
                onClick={() => {
                  if (contact.kind === "doctor" && contact.doctorId) {
                    setActiveAssistant("doctor");
                    setActiveDoctorId(contact.doctorId);
                  } else {
                    setActiveAssistant(contact.kind);
                    setActiveDoctorId(null);
                  }
                }}
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8EFE6]/80">
                  <Icon className="h-5 w-5 text-[#2C3E6B]" />
                  {unreadN > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
                      {unreadN > 9 ? "9+" : unreadN}
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#2C3E6B]">
                    {contact.name}
                  </p>
                  {(preview?.snippet ?? "").trim() ? (
                    <p className="truncate text-xs text-[#6B7280]">
                      {preview?.snippet}
                    </p>
                  ) : null}
                </div>
                {(preview?.time ?? "").trim() ? (
                  <span className="shrink-0 text-xs text-[#6B7280]">
                    {preview?.time}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div
        className={`relative flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden ${CARD_SHADOW}`}
      >
        <div className="flex items-center justify-between border-b border-white/40 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFE6]/80">
                {(() => {
                  const Icon = activeContact.icon;
                  return <Icon className="h-5 w-5 text-[#2C3E6B]" />;
                })()}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-[#2C3E6B]">{activeContact.name}</p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeAssistant === "support" || activeAssistant === "doctor" ? (
              <button
                type="button"
                title="Hide past messages on your screen only"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/60 bg-white/30 px-3 text-sm font-medium text-[#2C3E6B] backdrop-blur-sm transition-colors hover:bg-white/80"
                disabled={isLoading}
                onClick={() => void clearClinicChatView()}
              >
                <Eraser className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Clear my view</span>
              </button>
            ) : null}
            {activeAssistant === "ai" ? (
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-full bg-[#2C3E6B] px-5 text-sm font-medium text-white shadow-md transition-colors hover:bg-[#3d5080] whitespace-nowrap"
                onClick={async () => {
                  setError(null);
                  setIsLoading(true);
                  try {
                    const threadId = await createPlainThread("ai");
                    await seedAssistantGreeting("ai", threadId, AI_GREETING);
                    const { messages: seeded } = await fetchPlainMessages("ai");
                    setMessages(seeded);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to start new chat.");
                  } finally {
                    setIsLoading(false);
                    setInputValue("");
                  }
                }}
              >
                New chat
              </button>
            ) : null}
          </div>
        </div>

        {doctorChatBlocked ? (
          <div className="border-b border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 sm:px-6">
            {doctorChatDisabledMessage}
          </div>
        ) : null}

        <div
          ref={messagesScrollRef}
          className="flex-1 overflow-y-auto bg-[#E8EFE6]/20 p-4 sm:p-6"
        >
          <div className="flex flex-col gap-4">
            {messages.map((msg) => {
              const ts =
                formatMessageTimestamp(msg.createdAt) ||
                (msg.sender === "patient" ? "Just now" : "");
              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "patient" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[80%] ${
                      msg.sender === "patient" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`w-full px-4 py-2.5 ${
                        msg.sender === "patient"
                          ? "rounded-l-2xl rounded-tr-2xl bg-[#2C3E6B] text-white"
                          : "rounded-r-2xl rounded-tl-2xl border border-white/60 bg-white/45 text-[#2C3E6B] backdrop-blur-sm"
                      }`}
                    >
                      {parseChatAttachments(msg.attachmentUrl).map((uri, idx) =>
                        dataUriKind(uri) === "image" ? (
                          <a
                            key={`${msg.id}-img-${idx}`}
                            href={uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-2 block"
                          >
                            <img
                              src={uri}
                              alt="Chat attachment"
                              className="max-h-56 w-auto rounded-xl border border-black/10 object-contain"
                            />
                          </a>
                        ) : dataUriKind(uri) === "audio" ? (
                          <audio
                            key={`${msg.id}-audio-${idx}`}
                            controls
                            preload="metadata"
                            src={uri}
                            className="mb-2 h-9 w-full max-w-sm"
                          />
                        ) : null
                      )}
                      <div className="text-sm leading-relaxed [&_a]:break-words">
                        <ReactMarkdown
                          skipHtml={true}
                          components={{
                            a: ({ href, children, ...rest }) => (
                              <a
                                {...rest}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={
                                  msg.sender === "patient"
                                    ? "font-semibold text-white underline decoration-white/90 underline-offset-2 hover:text-white"
                                    : "font-semibold text-blue-600 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-700"
                                }
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {typingMessageId === msg.id && msg.sender !== "patient"
                            ? messageDisplayText(msg).slice(
                                0,
                                typingIndex || messageDisplayText(msg).length
                              )
                            : messageDisplayText(msg)}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {ts ? (
                      <time
                        className="px-1 text-[11px] tabular-nums text-zinc-400"
                        {...(msg.createdAt &&
                        !Number.isNaN(Date.parse(msg.createdAt))
                          ? {
                              dateTime: msg.createdAt,
                              title: msg.createdAt,
                            }
                          : {})}
                      >
                        {ts}
                      </time>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {isLoading && activeAssistant === "ai" ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-r-2xl rounded-tl-2xl border border-white/60 bg-white/45 px-4 py-2.5 text-sm text-[#6B7280] backdrop-blur-sm">
                  Thinking…
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-r-2xl rounded-tl-2xl border border-rose-200/60 bg-rose-50/70 px-4 py-2.5 text-sm text-rose-800 backdrop-blur-sm">
                  {error}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {!doctorChatBlocked ? (
        <div className="border-t border-white/40 bg-white/30 p-4 backdrop-blur-sm">
          {composerError ? (
            <p role="alert" className="mb-2 text-xs font-medium text-rose-700">
              {composerError}
            </p>
          ) : null}
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((file) => (
                <span
                  key={file.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-teal-100 bg-teal-50/90 py-1 pl-2.5 pr-1 text-xs font-medium text-teal-900"
                >
                  <span className="max-w-[140px] truncate">{file.fileName}</span>
                  <button
                    type="button"
                    title="Remove attachment"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-teal-700 hover:bg-teal-100"
                    onClick={() => removeAttachment(file.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {isRecording ? (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-3 py-2">
              <span className="text-sm font-bold tabular-nums text-rose-700">
                {formatMmSs(recordElapsed)}
              </span>
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden />
                Stop recording
              </button>
            </div>
          ) : null}

            <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/30 px-3 py-2 backdrop-blur-sm">
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*,audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const input = e.currentTarget;
                  const picked = input.files ? Array.from(input.files) : [];
                  input.value = "";
                  if (picked.length === 0) return;
                  void addAttachmentFiles(picked);
                }}
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2C3E6B]/50 transition-colors hover:bg-white/60 hover:text-[#2C3E6B] disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  activeAssistant === "ai"
                    ? "Attachments are disabled for AI chat"
                    : "Attach images or audio files"
                }
                disabled={activeAssistant === "ai" || isLoading || isRecording}
                onClick={() => attachmentInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2C3E6B]/50 transition-colors hover:bg-white/60 hover:text-[#2C3E6B] disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  activeAssistant === "ai"
                    ? "Voice notes are disabled for AI chat"
                    : "Record voice note"
                }
                disabled={activeAssistant === "ai" || isLoading || isRecording}
                onClick={() => void startRecording()}
              >
                <Mic className="h-5 w-5" />
              </button>
              <input
                type="text"
                placeholder={
                  activeAssistant === "ai"
                    ? "Type a message for AI..."
                    : "Type a message (attach with paperclip or mic)..."
                }
                className="max-h-24 min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-[#2C3E6B] placeholder:text-[#2C3E6B]/40 focus:outline-none"
                value={inputValue}
                disabled={isRecording}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-white shadow-md transition-colors hover:bg-[#3d5080] disabled:opacity-40"
                title="Send"
                disabled={
                  isLoading ||
                  isRecording ||
                  (activeAssistant === "ai"
                    ? !inputValue.trim()
                    : !inputValue.trim() && attachments.length === 0)
                }
                onClick={() => void sendMessage()}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
        </div>
        ) : null}
      </div>
    </motion.div>
  );
}
