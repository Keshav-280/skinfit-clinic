"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Search,
  Bot,
  User,
  Phone,
  Video,
  Paperclip,
  Send,
} from "lucide-react";

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

const CARD_SHADOW = "rounded-[22px] border border-zinc-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]";

export default function ChatPage() {
  type AssistantId = "ai" | "doctor" | "support";
  type ChatMsg = {
    id: string;
    sender: AssistantId | "patient";
    text: string;
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

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeAssistant)!,
    [activeAssistant]
  );

  const fetchPlainMessages = useCallback(
    async (assistantId: AssistantId): Promise<ChatMsg[]> => {
      const res = await fetch(
        `/api/chat/plain/messages?assistantId=${encodeURIComponent(
          assistantId
        )}`,
        { credentials: "include" }
      );

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        messages?: Array<{
          id: string;
          sender: AssistantId | "patient";
          text: string;
          createdAt?: string;
        }>;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to fetch messages (${res.status})`);
      }

      const rows = data.messages ?? [];
      return rows.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      }));
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

  const loadContactPreviews = useCallback(async () => {
    const assistants: AssistantId[] = ["ai", "doctor", "support"];
    const next: Partial<Record<AssistantId, { snippet: string; time: string }>> = {};

    await Promise.all(
      assistants.map(async (assistantId) => {
        try {
          const plainMessages = await fetchPlainMessages(assistantId);
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
    let cancelled = false;

    async function loadAiThread() {
      setError(null);
      setIsLoading(true);
      setMessages([]);
      try {
        const plainMessages = await fetchPlainMessages("ai");
        if (cancelled) return;

        if (plainMessages.length === 0) {
          const threadId = await createPlainThread("ai");
          if (cancelled) return;

          // Seed fixed first message into DB.
          await seedAssistantGreeting("ai", threadId, AI_GREETING);
          if (cancelled) return;

          const seeded = await fetchPlainMessages("ai");
          if (cancelled) return;

          setMessages(seeded);
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
        const plainMessages = await fetchPlainMessages(activeAssistant);
        if (cancelled) return;
        setMessages(plainMessages);
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

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setError(null);

    // LLM assistant chat (AI only for SkinnFit AI Assistant).
    if (activeAssistant === "ai") {
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
        const refreshed = await fetchPlainMessages("ai");
        setMessages(refreshed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Plain stored chat for Dr Ruby / Clinic Support (no AI replies).
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/plain/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assistantId: activeAssistant,
          text,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to send message (${res.status})`);
      }

      const refreshed = await fetchPlainMessages(activeAssistant);
      setMessages(refreshed);
      setInputValue("");
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
        <div className="border-b border-zinc-100 p-4">
          <h1 className="mb-3 text-center text-xl font-bold text-zinc-900 md:hidden">
            Chat
          </h1>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              type="text"
              placeholder="Search messages or doctors..."
              className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[240px] flex-1 overflow-y-auto md:max-h-none">
          {contacts.map((contact) => {
            const Icon = contact.icon;
            return (
              <div
                key={contact.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-4 transition-colors hover:bg-zinc-50 ${
                  contact.id === activeAssistant ? "bg-[#E0F0ED]/60" : ""
                }`}
                onClick={() => setActiveAssistant(contact.id as AssistantId)}
              >
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E0F0ED]">
                  <Icon className="h-5 w-5 text-[#6B8E8E]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {contact.name}
                  </p>
                  {(contactPreviews[contact.id as AssistantId]?.snippet ?? "")
                    .trim() ? (
                    <p className="truncate text-xs text-zinc-500">
                      {contactPreviews[contact.id as AssistantId]?.snippet}
                    </p>
                  ) : null}
                </div>
                {(contactPreviews[contact.id as AssistantId]?.time ?? "").trim() ? (
                  <span className="shrink-0 text-xs text-zinc-400">
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
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E0F0ED]">
                <Bot className="h-5 w-5 text-[#6B8E8E]" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900">{activeContact.name}</p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeAssistant === "ai" ? (
              <button
                type="button"
                className="flex h-9 items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 hover:text-teal-900 whitespace-nowrap"
                onClick={async () => {
                  setError(null);
                  setIsLoading(true);
                  try {
                    const threadId = await createPlainThread("ai");
                    await seedAssistantGreeting("ai", threadId, AI_GREETING);
                    const seeded = await fetchPlainMessages("ai");
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
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-teal-700"
              title="Voice call"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-teal-700"
              title="Video call"
            >
              <Video className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#FDF9F0]/30 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "patient" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 sm:max-w-[80%] ${
                    msg.sender === "patient"
                      ? "rounded-l-2xl rounded-tr-2xl bg-teal-600 text-white"
                      : "rounded-r-2xl rounded-tl-2xl border border-zinc-100 bg-white text-zinc-800 shadow-sm"
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    <ReactMarkdown skipHtml={true}>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && activeAssistant === "ai" ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-r-2xl rounded-tl-2xl border border-zinc-100 bg-white px-4 py-2.5 text-sm text-zinc-500 shadow-sm">
                  Thinking…
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-r-2xl rounded-tl-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 shadow-sm">
                  {error}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-zinc-100 bg-white p-4">
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white hover:text-teal-700"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              className="max-h-24 flex-1 bg-transparent px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition-colors hover:bg-teal-500"
              title="Send"
              disabled={isLoading}
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
