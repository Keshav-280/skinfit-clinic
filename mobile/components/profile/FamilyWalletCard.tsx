import { Ionicons } from "@expo/vector-icons";
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
import { card, NAVY, TEXT_MUTED, TEXT_PRIMARY, BORDER_LIGHT } from "@/components/profile/theme";
import type { FamilyWalletSnapshot } from "../../../src/lib/familyWallet";

function formatCredits(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function memberInitial(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
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
  const [showInvite, setShowInvite] = useState(false);
  const [showActivity, setShowActivity] = useState(false);

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
      setShowInvite(false);
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
      <View style={[s.card, s.loadingWrap]}>
        <ActivityIndicator size="small" color={NAVY} />
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

  const linkedMembers = data.members.filter((m) => m.role === "member");

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.iconBox}>
          <Ionicons name="card-outline" size={16} color="#fff" />
        </View>
        <View style={s.headerText}>
          <View style={s.titleRow}>
            <Text style={s.kicker}>Family card</Text>
            <View style={s.verifiedPill}>
              <Ionicons name="shield-checkmark" size={11} color={NAVY} />
              <Text style={s.verifiedText}>Clinic verified</Text>
            </View>
          </View>
          <Text style={s.balance}>
            {formatCredits(data.balanceCredits)}
            <Text style={s.balanceUnit}> credits</Text>
          </Text>
          {!data.isOwner ? (
            <Text style={s.heldBy}>Held by {data.ownerName}</Text>
          ) : null}
        </View>
      </View>

      {(error || hint) ? (
        <View style={s.alerts}>
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
        </View>
      ) : null}

      <View style={s.divider} />

      <Text style={s.sectionLabel}>Members · {data.members.length}</Text>
      {data.members.map((m) => (
        <View key={m.userId} style={s.memberRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{memberInitial(m.name)}</Text>
          </View>
          <View style={s.memberInfo}>
            <Text style={s.memberName} numberOfLines={1}>
              {m.name}
              {m.role === "owner" ? (
                <Text style={s.holderSuffix}> · Holder</Text>
              ) : null}
            </Text>
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
              <Ionicons name="trash-outline" size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      ))}

      {data.isOwner ? (
        <View style={s.inviteSection}>
          {!showInvite ? (
            <Pressable
              onPress={() => {
                setShowInvite(true);
                setHint(null);
                setError(null);
              }}
              style={s.addBtn}
            >
              <Ionicons name="person-add-outline" size={14} color={NAVY} />
              <Text style={s.addBtnText}>
                {linkedMembers.length === 0 ? "Add family member" : "Link another member"}
              </Text>
            </Pressable>
          ) : (
            <View style={s.inviteForm}>
              <Text style={s.inviteHint}>
                They need a SkinFit account. We&apos;ll email them a code.
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
              <View style={s.inviteActions}>
                <Pressable
                  onPress={() => void sendOtp()}
                  disabled={inviteBusy || !inviteEmail.trim() || resendSeconds > 0}
                  style={[
                    s.sendBtn,
                    (inviteBusy || !inviteEmail.trim() || resendSeconds > 0) && s.btnDisabled,
                  ]}
                >
                  <Text style={s.sendBtnText}>
                    {inviteBusy ? "…" : resendSeconds > 0 ? `Resend ${resendSeconds}s` : "Send code"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowInvite(false);
                    setOtpSent(false);
                    setInviteEmail("");
                    setOtp("");
                  }}
                  style={s.cancelBtn}
                >
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
              {otpSent ? (
                <View style={s.otpRow}>
                  <TextInput
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!inviteBusy}
                    style={[s.input, s.otpInput]}
                  />
                  <Pressable
                    onPress={() => void verifyAndLink()}
                    disabled={inviteBusy || otp.length < 6}
                    style={[s.linkBtn, (inviteBusy || otp.length < 6) && s.btnDisabled]}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={s.linkBtnText}>Link</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <Text style={s.memberNote}>
          Visit the clinic to use shared credits — staff deduct after your visit.
        </Text>
      )}

      {data.recentTransactions.length > 0 ? (
        <View style={s.activitySection}>
          <Pressable
            onPress={() => setShowActivity((v) => !v)}
            style={s.activityToggle}
          >
            <Text style={s.activityLabel}>Recent activity</Text>
            <Ionicons
              name={showActivity ? "chevron-up" : "chevron-down"}
              size={16}
              color={TEXT_MUTED}
            />
          </Pressable>
          {showActivity
            ? data.recentTransactions.map((tx) => (
                <View key={tx.id} style={s.txRow}>
                  <View style={s.txLeft}>
                    <Text style={s.txType}>{tx.type}</Text>
                    {tx.patientName ? (
                      <Text style={s.txMeta}> · {tx.patientName}</Text>
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
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    ...card.base,
    padding: 16,
  },
  loadingWrap: {
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    borderRadius: 16,
    marginBottom: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 14,
  },
  errorText: { color: "#991b1b", fontSize: 14 },

  headerRow: { flexDirection: "row", gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(43,58,103,0.08)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 10, fontWeight: "600", color: NAVY },
  balance: { marginTop: 4, fontSize: 24, fontWeight: "800", color: TEXT_PRIMARY },
  balanceUnit: { fontSize: 14, fontWeight: "600", color: TEXT_MUTED },
  heldBy: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },

  alerts: { marginTop: 10 },
  alertError: {
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alertErrorText: { color: "#991b1b", fontSize: 12 },
  alertOk: {
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alertOkText: { color: "#166534", fontSize: 12 },

  divider: {
    height: 1,
    backgroundColor: "#E8EFE6",
    marginTop: 14,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: TEXT_MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8EFE6",
    backgroundColor: "#FAFCFA",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(43,58,103,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "700", color: NAVY },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY },
  holderSuffix: { fontSize: 10, fontWeight: "700", color: TEXT_MUTED, textTransform: "uppercase" },
  memberEmail: { marginTop: 1, fontSize: 12, color: TEXT_MUTED },
  removeBtn: { padding: 4 },

  inviteSection: { marginTop: 8 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(43,58,103,0.15)",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: 12, fontWeight: "600", color: NAVY },
  inviteForm: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: "#FAFCFA",
    padding: 12,
  },
  inviteHint: { fontSize: 12, color: TEXT_MUTED, marginBottom: 8, lineHeight: 17 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2A44",
  },
  inviteActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  sendBtn: {
    borderRadius: 10,
    backgroundColor: NAVY,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center" },
  cancelBtnText: { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  otpRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  otpInput: { flex: 1, minWidth: 0 },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 10,
    backgroundColor: NAVY,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.5 },

  memberNote: { marginTop: 8, fontSize: 12, color: TEXT_MUTED, lineHeight: 18 },

  activitySection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#E8EFE6", paddingTop: 10 },
  activityToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityLabel: { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  txLeft: { flex: 1, flexDirection: "row", flexWrap: "wrap", minWidth: 0 },
  txType: { fontSize: 12, fontWeight: "600", color: TEXT_PRIMARY, textTransform: "capitalize" },
  txMeta: { fontSize: 12, color: TEXT_MUTED },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 12, fontWeight: "700" },
  txAmountPos: { color: "#16a34a" },
  txAmountNeg: { color: TEXT_PRIMARY },
  txDate: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
});
