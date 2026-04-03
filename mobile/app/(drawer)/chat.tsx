import { Ionicons } from "@expo/vector-icons";
import { format, isValid, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatMessageMarkdown } from "@/components/ChatMessageMarkdown";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import {
  markClinicSupportInboxSeenFromServer,
  markDoctorInboxSeenFromServer,
} from "@/lib/inboxReadCursors";

type AssistantId = "ai" | "doctor" | "support";

/** API + DB use patient | doctor | support (AI assistant rows use sender "support"). */
type ChatSender = "patient" | "doctor" | "support";

type ChatMsg = {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt?: string;
};

const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const CREAM = "#fdf9f0";
const ZINC_900 = "#18181b";

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
    name: "Dr. Ruby Sachdev",
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

function incomingFromLabel(sender: ChatSender, tab: AssistantId): string {
  if (sender === "doctor") return "Doctor";
  if (tab === "ai" && sender === "support") return "AI";
  return "Support";
}

export default function ChatScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const [active, setActive] = useState<AssistantId>("ai");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peer = useMemo(() => CONTACTS.find((c) => c.id === active)!, [active]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length, scrollToEnd]);

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
      return {
        messages: normalizeApiMessages(data.messages),
        clinicReadThroughIso: data.clinicReadThroughIso,
      };
    },
    [token]
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
    let cancelled = false;
    (async () => {
      if (!token) return;
      setLoading(true);
      setError(null);
      setMessages([]);
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
        } else {
          const plain = await fetchPlainMessages(active);
          if (cancelled) return;
          setMessages(plain.messages);
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
  }, [active, token, fetchPlainMessages, createPlainThread, seedAssistantGreeting]);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await apiJson("/api/chat/plain/message", token, {
        method: "POST",
        body: JSON.stringify({ assistantId: active, text }),
      });
      const refreshed = await fetchPlainMessages(active);
      setMessages(refreshed.messages);
      setInput("");
      if (active === "support") {
        await markClinicSupportInboxSeenFromServer(refreshed.clinicReadThroughIso);
      } else if (active === "doctor") {
        await markDoctorInboxSeenFromServer(refreshed.clinicReadThroughIso);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.hero}>
          <Text style={styles.screenTitle}>Messages</Text>
          <Text style={styles.screenSub}>Choose who you&apos;re talking to</Text>
        </View>

        <View style={styles.tabsRow}>
          {CONTACTS.map((c) => {
            const on = active === c.id;
            return (
              <Pressable
                key={c.id}
                style={[
                  styles.tabChip,
                  on && { backgroundColor: c.accentSoft, borderColor: c.accent },
                ]}
                onPress={() => setActive(c.id)}
              >
                <View style={[styles.tabIconWrap, { backgroundColor: on ? c.accent : "#e4e4e7" }]}>
                  <Ionicons name={c.icon} size={15} color={on ? "#fff" : "#52525b"} />
                </View>
                <Text
                  style={[styles.tabChipLabel, on && { color: c.accent, fontWeight: "700" }]}
                  numberOfLines={1}
                >
                  {c.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.peerCard, { borderLeftColor: peer.accent }]}>
          <View style={[styles.peerAvatar, { backgroundColor: peer.accentSoft }]}>
            <Ionicons name={peer.icon} size={20} color={peer.accent} />
          </View>
          <View style={styles.peerText}>
            <Text style={styles.peerName} numberOfLines={1}>
              {peer.name}
            </Text>
            <Text style={styles.peerSubtitle} numberOfLines={1}>
              {peer.subtitle}
            </Text>
          </View>
        </View>

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
              data={messages}
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
                messages.length === 0 && styles.listContentEmpty,
              ]}
              renderItem={({ item }) => {
                const isPatient = item.sender === "patient";
                const t = formatMsgTime(item.createdAt);
                return (
                  <View style={[styles.msgRow, isPatient ? styles.msgRowPatient : styles.msgRowOther]}>
                    {!isPatient ? (
                      <Text style={styles.msgFrom}>{incomingFromLabel(item.sender, active)}</Text>
                    ) : (
                      <Text style={styles.msgFromPatient}>You</Text>
                    )}
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
                      {t ? (
                        <Text style={[styles.ts, isPatient ? styles.tsPatient : styles.tsOther]}>{t}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        {(active === "support" || active === "doctor") && messages.length > 0 ? (
          <Pressable style={styles.clearBtn} onPress={clearView} hitSlop={8}>
            <Ionicons name="eye-off-outline" size={16} color="#64748b" />
            <Text style={styles.clearBtnText}>Clear my view</Text>
          </Pressable>
        ) : null}

        <View style={styles.composer}>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    backgroundColor: CREAM,
    paddingHorizontal: 16,
  },
  hero: { paddingTop: 2, paddingBottom: 8, flexShrink: 0 },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: ZINC_900,
    letterSpacing: -0.4,
  },
  screenSub: { fontSize: 13, color: "#64748b", marginTop: 2 },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    alignItems: "center",
    flexShrink: 0,
  },
  tabChip: {
    flex: 1,
    minWidth: 0,
    maxHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tabIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  tabChipLabel: { fontSize: 12, fontWeight: "600", color: "#52525b", flexShrink: 1 },
  peerCard: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  peerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  peerText: { flex: 1, minWidth: 0 },
  peerName: { fontSize: 15, fontWeight: "700", color: ZINC_900 },
  peerSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 16 },
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
  listWrap: { flex: 1, minHeight: 160, zIndex: 0 },
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
  msgRowPatient: { alignSelf: "flex-end", alignItems: "flex-end" },
  msgRowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  msgFrom: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  msgFromPatient: { fontSize: 11, fontWeight: "700", color: TEAL_DARK, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6 },
  bubble: {
    maxWidth: "92%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePatient: {
    backgroundColor: TEAL,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  ts: { fontSize: 11, marginTop: 6 },
  tsPatient: { color: "rgba(255,255,255,0.85)", alignSelf: "flex-end" },
  tsOther: { color: "#94a3b8" },
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: CREAM,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: ZINC_900,
  },
  sendFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 2,
  },
  sendFabDisabled: { opacity: 0.45, shadowOpacity: 0 },
});
