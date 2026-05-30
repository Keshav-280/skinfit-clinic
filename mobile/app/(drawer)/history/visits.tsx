import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { format, parseISO } from "date-fns";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { apiJson } from "@/lib/api";
import { getCached, setCached } from "@/lib/apiCache";

const NAVY = "#2B3A67";
const BG: [string, string] = ["#E8EFE6", "#DCE8D4"];

type VisitRow = {
  id: string;
  visitDateYmd: string;
  doctorName: string;
  notes: string;
  purpose?: string | null;
  treatments?: string | null;
  responseRating?: string | null;
};

type HistoryPayload = {
  visitNotes: VisitRow[];
  [k: string]: unknown;
};

const RATING_COLORS: Record<string, { bg: string; fg: string }> = {
  excellent: { bg: "#dcfce7", fg: "#166534" },
  good: { bg: "#dcfce7", fg: "#166534" },
  moderate: { bg: "#fef9c3", fg: "#854d0e" },
  poor: { bg: "#fee2e2", fg: "#991b1b" },
};

export default function VisitsListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const cacheKey = "history-visits";
    const cached = await getCached<VisitRow[]>(cacheKey);
    if (cached && cached.length > 0) {
      setVisits(cached);
    }
    const data = await apiJson<HistoryPayload>("/api/patient/history?include=visits", token, {
      method: "GET",
    });
    const next = data.visitNotes ?? [];
    setVisits(next);
    await setCached(cacheKey, next);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          await load();
        } catch {}
        finally {
          if (alive) setLoading(false);
        }
      })();
      return () => { alive = false; };
    }, [load])
  );

  if (loading && visits.length === 0) {
    return (
      <LinearGradient colors={BG} style={[s.center, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={NAVY} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={BG} style={{ flex: 1 }}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push("/(drawer)/profile")} hitSlop={12}>
          <View style={s.backCircle}>
            <Ionicons name="chevron-back" size={20} color={NAVY} />
          </View>
        </Pressable>
        <Text style={s.headerTitle}>History & Notes</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try { await load(); } finally { setRefreshing(false); }
            }}
          />
        }
      >
        {visits.length === 0 ? (
          <Text style={s.empty}>No clinic visits yet.</Text>
        ) : (
          visits.map((visit, idx) => {
            const dateStr = format(parseISO(`${visit.visitDateYmd}T12:00:00`), "d MMM yyyy");
            const label = visit.treatments ?? visit.purpose ?? visit.notes;
            const rating = visit.responseRating;
            const rKey = rating?.toLowerCase() ?? "";
            const rc = RATING_COLORS[rKey];
            const isFirst = idx === 0;

            return (
              <Pressable
                key={visit.id}
                style={[s.card, isFirst ? s.cardFirst : s.cardRest]}
                onPress={() => router.push(`/(drawer)/history/visit/${visit.id}` as any)}
              >
                <View style={s.row}>
                  <Ionicons name="checkbox-outline" size={22} color={NAVY} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <View style={s.topRow}>
                      <Text style={s.date}>{dateStr}</Text>
                      {isFirst ? (
                        <View style={s.latestPill}>
                          <Text style={s.latestText}>Latest</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.treatment} numberOfLines={1}>{label}</Text>
                    <Text style={s.doctor}>with Dr. {visit.doctorName}</Text>
                    {rating && rc ? (
                      <View style={[s.ratingPill, { backgroundColor: rc.bg }]}>
                        <Text style={[s.ratingText, { color: rc.fg }]}>
                          Response: {rating.charAt(0).toUpperCase() + rating.slice(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  content: { padding: 16 },
  empty: { textAlign: "center", color: "#52525b", paddingVertical: 40, fontSize: 14 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardFirst: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardRest: { backgroundColor: "#e8ede6" },
  row: { flexDirection: "row", alignItems: "center" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  date: { fontSize: 16, fontWeight: "700", color: "#1A1A2E" },
  latestPill: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  latestText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  treatment: { fontSize: 14, color: "#52525b", marginTop: 2 },
  doctor: { fontSize: 13, color: "#71717a", marginTop: 1 },
  ratingPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingText: { fontSize: 12, fontWeight: "700" },
});
