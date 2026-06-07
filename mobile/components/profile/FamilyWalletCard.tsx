import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { NAVY, TEXT_MUTED, TEXT_PRIMARY, BORDER_LIGHT } from "@/components/profile/theme";
import type { FamilyWalletSnapshot } from "../../../src/lib/familyWallet";

function formatCredits(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Props = {
  refreshing?: boolean;
};

export default function FamilyWalletCard({ refreshing = false }: Props) {
  const { token } = useAuth();
  const [data, setData] = useState<FamilyWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const prevRefreshing = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const json = await apiJson<FamilyWalletSnapshot>("/api/user/family-wallet", token, {
        method: "GET",
      });
      setData(json);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load family card.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      void load();
    }
    prevRefreshing.current = refreshing;
  }, [refreshing, load]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  async function sendOtp() {
    if (!token) return;
    setInviteBusy(true);
    setHint(null);
    setError(null);
    try {
      const json = await apiJson<{ message?: string; cooldownSeconds?: number; retryAfterSeconds?: number }>(
        "/api/user/family-wallet/invite/send-otp",
        token,
        {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail.trim() }),
        }
      );
      setOtpSent(true);
      setOtp("");
      setHint(json.message ?? "Code sent.");
      setResendSeconds(json.cooldownSeconds ?? 60);
    } catch (e) {
      const body = e instanceof ApiError ? e.body : {};
      setError(e instanceof ApiError ? e.message : "Could not send code.");
      if (typeof body.retryAfterSeconds === "number") {
        setResendSeconds(body.retryAfterSeconds);
      }
    } finally {
      setInviteBusy(false);
    }
  }

  async function verifyAndLink() {
    if (!token) return;
    setInviteBusy(true);
    setError(null);
    try {
      const json = await apiJson<{ message?: string }>(
        "/api/user/family-wallet/invite/verify",
        token,
        {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail.trim(), otp: otp.trim() }),
        }
      );
      setInviteEmail("");
      setOtp("");
      setOtpSent(false);
      setHint(json.message ?? "Member linked.");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not link member.");
    } finally {
      setInviteBusy(false);
    }
  }

  function removeMember(memberUserId: string, memberName: string) {
    if (!token) return;
    Alert.alert(
      "Remove member",
      `Remove ${memberName} from your family card?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setError(null);
            try {
              await apiJson(`/api/user/family-wallet/members/${memberUserId}`, token, {
                method: "DELETE",
              });
              await load();
            } catch (e) {
              setError(e instanceof ApiError ? e.message : "Could not remove member.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.errorWrap}>
        <Text style={s.errorText}>{error ?? "Family card unavailable."}</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <LinearGradient colors={["#2C3E6B", "#344875", "#1a2544"]} style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.heroLeft}>
            <View style={s.kickerRow}>
              <Ionicons name="card-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={s.kicker}>SkinFit Family Card</Text>
            </View>
            <Text style={s.balance}>
              {formatCredits(data.balanceCredits)}
              <Text style={s.balanceUnit}> credits</Text>
            </Text>
            <Text style={s.subtitle}>
              {data.isOwner
                ? "Top up at the clinic — shared with linked family"
                : `Shared card · held by ${data.ownerName}`}
            </Text>
          </View>
          <View style={s.badge}>
            <View style={s.badgeRow}>
              <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={s.badgeLabel}>Clinic verified</Text>
            </View>
            <Text style={s.badgeSub}>Offline top-up · portal deduct</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={s.body}>
        {error ? (
          <View style={s.alertError}>
            <Text style={s.alertErrorText}>{error}</Text>
          </View>
        ) : null}
        {hint && !error ? (
          <View style={s.alertOk}>
            <Text style={s.alertOkText}>{hint}</Text>
          </View>
        ) : null}

        <View style={s.sectionHead}>
          <Ionicons name="people-outline" size={16} color={NAVY} />
          <Text style={s.sectionTitle}>Family members</Text>
        </View>

        {data.members.map((m) => (
          <View key={m.userId} style={s.memberRow}>
            <View style={s.memberInfo}>
              <View style={s.memberNameRow}>
                <Text style={s.memberName} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.role === "owner" ? (
                  <View style={s.holderPill}>
                    <Text style={s.holderPillText}>Holder</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.memberEmail} numberOfLines={1}>
                {m.email}
              </Text>
            </View>
            {data.isOwner && m.role === "member" ? (
              <Pressable
                onPress={() => removeMember(m.userId, m.name)}
                hitSlop={8}
                style={s.removeBtn}
              >
                <Ionicons name="trash-outline" size={18} color={TEXT_MUTED} />
              </Pressable>
            ) : null}
          </View>
        ))}

        {data.isOwner ? (
          <View style={s.inviteBox}>
            <Text style={s.inviteHint}>
              Link a family member by email (they must already have a SkinFit account)
            </Text>
            <TextInput
              value={inviteEmail}
              onChangeText={(t) => {
                setInviteEmail(t);
                setOtpSent(false);
              }}
              placeholder="family@email.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!inviteBusy}
              style={s.input}
            />
            <Pressable
              onPress={() => void sendOtp()}
              disabled={inviteBusy || !inviteEmail.trim() || resendSeconds > 0}
              style={[s.secondaryBtn, (inviteBusy || !inviteEmail.trim() || resendSeconds > 0) && s.btnDisabled]}
            >
              <Text style={s.secondaryBtnText}>
                {inviteBusy ? "…" : resendSeconds > 0 ? `${resendSeconds}s` : "Send OTP"}
              </Text>
            </Pressable>
            {otpSent ? (
              <>
                <TextInput
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code from their email"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!inviteBusy}
                  style={[s.input, { marginTop: 10 }]}
                />
                <Pressable
                  onPress={() => void verifyAndLink()}
                  disabled={inviteBusy || otp.length < 6}
                  style={[s.primaryBtn, (inviteBusy || otp.length < 6) && s.btnDisabled]}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>Link member</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : (
          <Text style={s.memberNote}>
            Credits are shared from {data.ownerName}&apos;s family card. Visit the clinic to use
            credits — staff will deduct after confirming your visit.
          </Text>
        )}

        {data.recentTransactions.length > 0 ? (
          <View style={s.txSection}>
            <Text style={s.txTitle}>Recent activity</Text>
            {data.recentTransactions.map((tx) => (
              <View key={tx.id} style={s.txRow}>
                <View style={s.txLeft}>
                  <Text style={s.txType}>{tx.type}</Text>
                  {tx.patientName ? (
                    <Text style={s.txMeta}> · {tx.patientName}</Text>
                  ) : null}
                  {tx.note ? (
                    <Text style={s.txNote} numberOfLines={1}>
                      {tx.note}
                    </Text>
                  ) : null}
                </View>
                <View style={s.txRight}>
                  <Text
                    style={[
                      s.txAmount,
                      tx.amountCredits >= 0 ? s.txAmountPos : s.txAmountNeg,
                    ]}
                  >
                    {tx.amountCredits >= 0 ? "+" : ""}
                    {formatCredits(tx.amountCredits)}
                  </Text>
                  <Text style={s.txDate}>{formatWhen(tx.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  loadingWrap: {
    minHeight: 140,
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    borderRadius: 18,
    marginBottom: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 14,
  },
  errorText: { color: "#991b1b", fontSize: 14 },

  hero: { padding: 18 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  heroLeft: { flex: 1, minWidth: 0 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  balance: { marginTop: 10, fontSize: 36, fontWeight: "800", color: "#fff" },
  balanceUnit: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  subtitle: { marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 },
  badge: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
  },
  badgeSub: { marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.65)" },

  body: { padding: 16, backgroundColor: "#fff" },
  alertError: {
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertErrorText: { color: "#991b1b", fontSize: 13 },
  alertOk: {
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertOkText: { color: "#166534", fontSize: 13 },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8EFE6",
    backgroundColor: "#F8FBF7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  memberInfo: { flex: 1, minWidth: 0 },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  memberName: { fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY, flexShrink: 1 },
  holderPill: {
    backgroundColor: "rgba(43,58,103,0.1)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  holderPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: NAVY,
    textTransform: "uppercase",
  },
  memberEmail: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },
  removeBtn: { padding: 6 },

  inviteBox: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(43,58,103,0.25)",
    backgroundColor: "#F2F9F2",
    padding: 12,
  },
  inviteHint: { fontSize: 12, fontWeight: "600", color: NAVY, marginBottom: 10, lineHeight: 17 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "rgba(43,58,103,0.1)",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: NAVY },
  primaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: NAVY,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.5 },

  memberNote: { marginTop: 6, fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

  txSection: { marginTop: 14 },
  txTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  txLeft: { flex: 1, minWidth: 0 },
  txType: { fontSize: 12, fontWeight: "600", color: TEXT_PRIMARY, textTransform: "capitalize" },
  txMeta: { fontSize: 12, color: TEXT_MUTED },
  txNote: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 12, fontWeight: "700" },
  txAmountPos: { color: "#16a34a" },
  txAmountNeg: { color: TEXT_PRIMARY },
  txDate: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
});
