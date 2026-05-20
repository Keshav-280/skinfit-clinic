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
import {
  decryptMessages,
  encryptOutgoingText,
  setupDoctorPatientE2ee,
  type DoctorThreadE2eeSession,
} from "@/src/lib/chatE2ee/client";

const contacts = [
  {
    id: "ai",
    name: "SkinnFit AI Assistant",
    isActive: true,
    icon: Bot,
  },
  {
    id: "doctor",
    name: "Dr. Ruby Sachdev",
    isActive: false,
    icon: User,
  },
  {
    id: "support",
    name: "Clinic Support",
    isActive: false,
    icon: User,
  },
];

const CARD_SHADOW = "rounded-[22px] border border-white/70 bg-white/35 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.04)]";

const MAX_CHAT_ATTACHMENT_URI_LEN = 3_200_000;

function dataUriKind(uri: string | null | undefined): "image" | "audio" | "other" | null {
  if (!uri) return null;
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  return "other";
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FILE_READ_FAILED"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ChatPage() {
  type AssistantId = "ai" | "doctor" | "support";
  type ChatMsg = {
    id: string;
    sender: AssistantId | "patient";
    text: string;
    attachmentUrl?: string | null;
    createdAt?: string;
  };

  const [activeAssistant, setActiveAssistant] = useState<AssistantId>("ai");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const AI_GREETING =
    "Hi! I'm SkinnFit AI Assistant. How can I help you today?";
  const [contactPreviews, setContactPreviews] = useState<
    Partial<Record<AssistantId, { snippet: string; time: string }>>
  >({});
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingIndex, setTypingIndex] = useState(0);
  const [sidebarUnread, setSidebarUnread] = useState({ support: 0, doctor: 0 });
  const [attachment, setAttachment] = useState<{
    fileName: string;
    dataUri: string;
  } | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const activeAssistantRef = useRef<AssistantId>("ai");
  activeAssistantRef.current = activeAssistant;

  const doctorE2eeRef = useRef<DoctorThreadE2eeSession | null>(null);
  const [doctorE2eeReady, setDoctorE2eeReady] = useState(false);

  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeAssistant !== "doctor") {
      doctorE2eeRef.current = null;
      setDoctorE2eeReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const s = await setupDoctorPatientE2ee({ credentials: "include" });
      if (cancelled) return;
      doctorE2eeRef.current = s;
      setDoctorE2eeReady(Boolean(s?.ready));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAssistant]);

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

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeAssistant)!,
    [activeAssistant]
  );

  const fetchPlainMessages = useCallback(
    async (
      assistantId: AssistantId
    ): Promise<{ messages: ChatMsg[]; clinicReadThroughIso?: string }> => {
      const res = await fetch(
        `/api/chat/plain/messages?assistantId=${encodeURIComponent(
          assistantId
        )}`,
        { credentials: "include" }
      );

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
      let messages: ChatMsg[] = rows.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        attachmentUrl: m.attachmentUrl ?? null,
        createdAt: m.createdAt,
      }));
      if (assistantId === "doctor" && doctorE2eeRef.current?.ready) {
        messages = await decryptMessages<ChatMsg>(messages, doctorE2eeRef.current);
      }
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
    const assistants: AssistantId[] = ["ai", "doctor", "support"];
    const next: Partial<Record<AssistantId, { snippet: string; time: string }>> = {};

    await Promise.all(
      assistants.map(async (assistantId) => {
        try {
          const { messages: plainMessages } = await fetchPlainMessages(assistantId);
          const last = plainMessages[plainMessages.length - 1];
          // For our UI: show snippet only if there's at least one message.
          next[assistantId] = last
            ? {
                snippet: truncate(last.text, 46),
                time: formatTimeLabel(last.createdAt),
              }
            : { snippet: "", time: "" };
        } catch {
          next[assistantId] = { snippet: "", time: "" };
        }
      })
    );

    setContactPreviews(next);
  }, [fetchPlainMessages]);

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
        body: JSON.stringify({ assistantId: aid }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not clear view");
      }
      const { messages: next, clinicReadThroughIso } = await fetchPlainMessages(aid);
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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const a = params.get("assistant");
    if (a === "support" || a === "doctor" || a === "ai") {
      setActiveAssistant(a);
    }
  }, []);

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
      setError(null);
      setIsLoading(true);
      setMessages([]);
      try {
        const { messages: plainMessages, clinicReadThroughIso } =
          await fetchPlainMessages(activeAssistant);
        if (cancelled) return;
        setMessages(plainMessages);
      setAttachment(null);
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
    fetchAssistantReply,
    fetchPlainMessages,
    createPlainThread,
    seedAssistantGreeting,
    AI_GREETING,
  ]);

  /**
   * Doctor / Clinic Support threads: poll for new messages while this tab is open.
   * (AI chat streams via send flow; plain threads had no live sync until this.)
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
        const { messages: next, clinicReadThroughIso } =
          await fetchPlainMessages(activeAssistant);
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

    const intervalMs = 3500;
    const t = window.setInterval(() => void syncPlainThread(), intervalMs);
    const onVisible = () => void syncPlainThread();
    const onInboxRefresh = () => void syncPlainThread(true);
    const onGlobalRefresh = () => void syncPlainThread(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, onInboxRefresh);
    window.addEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    void syncPlainThread();

    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CLINIC_SUPPORT_INBOX_REFRESH_EVENT, onInboxRefresh);
      window.removeEventListener(GLOBAL_LIVE_REFRESH_EVENT, onGlobalRefresh);
    };
  }, [activeAssistant, fetchPlainMessages, loadContactPreviews]);

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

    if (!text && !attachment) return;

    // Plain stored chat for Dr Ruby / Clinic Support (no AI replies).
    setIsLoading(true);
    try {
      let outboundText = text;
      if (activeAssistant === "doctor" && text && doctorE2eeRef.current?.ready) {
        outboundText = await encryptOutgoingText(text, doctorE2eeRef.current);
      }
      const res = await fetch("/api/chat/plain/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assistantId: activeAssistant,
          text: outboundText,
          attachmentUrl: attachment?.dataUri ?? null,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to send message (${res.status})`);
      }

      const { messages: refreshed, clinicReadThroughIso } =
        await fetchPlainMessages(activeAssistant);
      setMessages(refreshed);
      if (activeAssistant === "support") {
        markClinicSupportInboxSeenFromServer(clinicReadThroughIso);
      }
      if (activeAssistant === "doctor") {
        markDoctorInboxSeenFromServer(clinicReadThroughIso);
      }
      setInputValue("");
      setAttachment(null);
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
          {contacts.map((contact) => {
            const Icon = contact.icon;
            const unreadN =
              contact.id === "support"
                ? sidebarUnread.support
                : contact.id === "doctor"
                  ? sidebarUnread.doctor
                  : 0;
            return (
              <div
                key={contact.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-white/40 px-4 py-4 transition-colors hover:bg-white/40 ${
                  contact.id === activeAssistant ? "bg-white/30" : ""
                }`}
                onClick={() => setActiveAssistant(contact.id as AssistantId)}
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
                  {(contactPreviews[contact.id as AssistantId]?.snippet ?? "")
                    .trim() ? (
                    <p className="truncate text-xs text-[#6B7280]">
                      {contactPreviews[contact.id as AssistantId]?.snippet}
                    </p>
                  ) : null}
                </div>
                {(contactPreviews[contact.id as AssistantId]?.time ?? "").trim() ? (
                  <span className="shrink-0 text-xs text-[#6B7280]">
                    {contactPreviews[contact.id as AssistantId]?.time}
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
                <Bot className="h-5 w-5 text-[#2C3E6B]" />
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
                      {dataUriKind(msg.attachmentUrl) === "image" ? (
                        <a
                          href={msg.attachmentUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-2 block"
                        >
                          <img
                            src={msg.attachmentUrl ?? undefined}
                            alt="Chat attachment"
                            className="max-h-56 w-auto rounded-xl border border-black/10 object-contain"
                          />
                        </a>
                      ) : null}
                      {dataUriKind(msg.attachmentUrl) === "audio" ? (
                        <audio
                          controls
                          preload="metadata"
                          src={msg.attachmentUrl ?? undefined}
                          className="mb-2 h-9 w-full max-w-sm"
                        />
                      ) : null}
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
                            ? msg.text.slice(0, typingIndex || msg.text.length)
                            : msg.text}
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

        <div className="border-t border-white/40 bg-white/30 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/30 px-4 py-2 backdrop-blur-sm">
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,audio/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!f) return;
                if (activeAssistant === "ai") {
                  setError("Attachments are only available in Doctor and Clinic Support chats.");
                  return;
                }
                if (!f.type.startsWith("image/") && !f.type.startsWith("audio/")) {
                  setError("Only image or audio files are supported.");
                  return;
                }
                try {
                  const uri = await fileToDataUri(f);
                  if (uri.length > MAX_CHAT_ATTACHMENT_URI_LEN) {
                    setError("Attachment is too large. Try a smaller file.");
                    return;
                  }
                  setAttachment({ fileName: f.name, dataUri: uri });
                } catch {
                  setError("Could not read attachment.");
                }
              }}
            />
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#2C3E6B]/50 transition-colors hover:bg-white/60 hover:text-[#2C3E6B] disabled:cursor-not-allowed disabled:opacity-40"
              title={
                activeAssistant === "ai"
                  ? "Attachments are disabled for AI chat"
                  : "Attach image or audio"
              }
              disabled={activeAssistant === "ai" || isLoading}
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            {attachment ? (
              <span className="max-w-[160px] truncate rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
                {attachment.fileName}
              </span>
            ) : null}
            <input
              type="text"
              placeholder={
                activeAssistant === "ai"
                  ? "Type a message for AI..."
                  : "Type a message (you can also attach image/audio)..."
              }
              className="max-h-24 flex-1 bg-transparent px-2 py-2 text-sm text-[#2C3E6B] placeholder:text-[#2C3E6B]/40 focus:outline-none"
              value={inputValue}
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C3E6B] text-white shadow-md transition-colors hover:bg-[#3d5080]"
              title="Send"
              disabled={
                isLoading ||
                (activeAssistant === "ai"
                  ? !inputValue.trim()
                  : !inputValue.trim() && !attachment)
              }
              onClick={() => void sendMessage()}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
