import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import {
  getClinicSupportInboxLastSeenIso,
  getDoctorInboxLastSeenIso,
  subscribeInboxReadCursors,
} from "@/lib/inboxReadCursors";

export function NotificationBell() {
  const { token } = useAuth();
  const router = useRouter();
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    if (!token) {
      setTotal(0);
      return;
    }
    try {
      const [supportSince, doctorSince] = await Promise.all([
        getClinicSupportInboxLastSeenIso(),
        getDoctorInboxLastSeenIso(),
      ]);
      const q = new URLSearchParams({ supportSince, doctorSince });
      const data = await apiJson<{ total?: number }>(
        `/api/chat/inbox/unread?${q.toString()}`,
        token,
        { method: "GET" }
      );
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setTotal(0);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const unsub = subscribeInboxReadCursors(() => void load());
      const id = setInterval(() => void load(), 45000);
      return () => {
        clearInterval(id);
        unsub();
      };
    }, [load])
  );

  return (
    <Pressable
      style={styles.wrap}
      onPress={() => router.push("/(drawer)/notifications")}
      hitSlop={10}
      accessibilityLabel="Notifications"
    >
      <Ionicons name="notifications-outline" size={24} color="#18181b" />
      {total > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{total > 99 ? "99+" : String(total)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: 4, padding: 6, justifyContent: "center", alignItems: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
