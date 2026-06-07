import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnalysisMagicLoader } from "@/components/AnalysisMagicLoader";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiJson } from "@/lib/api";
import { getCached, setCached } from "@/lib/apiCache";

type TreatmentRow = {
  id: string;
  name: string;
  preCare: string[];
  postCareDos: string[];
  postCareDonts: string[];
  isBuiltIn?: boolean;
};

type TreatmentsPayload = {
  treatments: TreatmentRow[];
};

const NAVY = "#2C3E6B";
const BG = "#E8EFE6";
const GLASS = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "rgba(255,255,255,0.7)";
const DASHBOARD_HREF = "/(drawer)" as Href;

const CARD = {
  backgroundColor: GLASS,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: GLASS_BORDER,
};

function CareBullets({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <Text style={styles.emptyInline}>No items listed.</Text>;
  }
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TreatmentsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<TreatmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("hydrafacial");
  const [phase, setPhase] = useState<"pre" | "post">("pre");

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const cached = await getCached<TreatmentsPayload>("treatments");
    if (cached) {
      setData(cached);
      if (cached.treatments.some((t) => t.id === selectedId) === false && cached.treatments[0]) {
        setSelectedId(cached.treatments[0].id);
      }
    }
    const json = await apiJson<TreatmentsPayload>("/api/patient/treatments", token, {
      method: "GET",
    });
    setData(json);
    if (json.treatments.some((t) => t.id === selectedId) === false && json.treatments[0]) {
      setSelectedId(json.treatments[0].id);
    }
    await setCached("treatments", json);
  }, [token, selectedId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (alive) {
          setError(e instanceof ApiError ? e.message : "Could not load treatments.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.loadingScreen}>
        <AnalysisMagicLoader
          title="Loading clinic treatments"
          subtitle="Pre- and post-care guides from your clinic."
          steps={["Hydrafacial", "Pre-care", "Post-care"]}
        />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{error}</Text>
      </View>
    );
  }

  const treatments = data?.treatments ?? [];
  const selected =
    treatments.find((t) => t.id === selectedId) ?? treatments[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.replace(DASHBOARD_HREF)}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="chevron-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Clinic Treatments</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        <Text style={styles.sectionTitle}>In-clinic care guides</Text>
        <Text style={styles.sectionHint}>
          Follow these instructions before and after offline treatments at your clinic.
          Your doctor may also send personalized care in chat.
        </Text>

        {treatments.length === 0 ? (
          <Text style={styles.empty}>No treatment guides available yet.</Text>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {treatments.map((t) => {
                const active = t.id === selected?.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedId(t.id)}
                    style={[styles.chip, active ? styles.chipActive : null]}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selected ? (
              <View style={[styles.careCard, CARD]}>
                <View style={styles.phaseTabs}>
                  {(["pre", "post"] as const).map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setPhase(p)}
                      style={[styles.phaseTab, phase === p ? styles.phaseTabActive : null]}
                    >
                      <Text
                        style={[
                          styles.phaseTabText,
                          phase === p ? styles.phaseTabTextActive : null,
                        ]}
                      >
                        {p === "pre" ? "Pre-care" : "Post-care"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {phase === "pre" ? (
                  <>
                    <Text style={styles.careHeading}>Before your treatment</Text>
                    <CareBullets items={selected.preCare} />
                  </>
                ) : (
                  <>
                    <Text style={styles.careHeading}>After your treatment (first 24h)</Text>
                    <Text style={styles.subHeading}>Do</Text>
                    <CareBullets items={selected.postCareDos} />
                    <Text style={[styles.subHeading, { marginTop: 16 }]}>Avoid</Text>
                    <CareBullets items={selected.postCareDonts} />
                  </>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#18181b" },
  scroll: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  loadingScreen: { flex: 1, backgroundColor: BG },
  err: { color: "#b91c1c", padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#18181b", marginBottom: 8 },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6B7280",
    marginBottom: 16,
  },
  empty: { textAlign: "center", color: "#6B7280", paddingVertical: 20, fontSize: 14 },
  emptyInline: { fontSize: 13, color: "#6B7280" },
  chipRow: { gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: `${NAVY}12`,
    borderWidth: 1,
    borderColor: `${NAVY}20`,
  },
  chipActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: NAVY },
  chipTextActive: { color: "#fff" },
  careCard: { padding: 16 },
  phaseTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  phaseTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: `${NAVY}18`,
  },
  phaseTabActive: {
    backgroundColor: NAVY,
    borderColor: NAVY,
  },
  phaseTabText: { fontSize: 13, fontWeight: "700", color: NAVY },
  phaseTabTextActive: { color: "#fff" },
  careHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  bulletList: { gap: 10 },
  bulletRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NAVY,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#374151",
  },
});
