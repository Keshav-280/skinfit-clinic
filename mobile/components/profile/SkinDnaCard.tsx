import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { card, NAVY, GREEN, TEXT_PRIMARY, TEXT_MUTED, BORDER_LIGHT } from "@/components/profile/theme";

type SkinDna = {
  skinType: string | null;
  primaryConcern: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
};

type Props = {
  skinDna: SkinDna;
  isNew?: boolean;
  onViewScanReports?: () => void;
};

const POSITIVE_VALUES = new Set(["detected", "high", "yes"]);

function valueColor(value: string | null): string {
  if (!value) return TEXT_MUTED;
  return POSITIVE_VALUES.has(value.toLowerCase()) ? GREEN : NAVY;
}

type Row = { label: string; value: string | null };

export default function SkinDnaCard({ skinDna, isNew, onViewScanReports }: Props) {
  const rows: Row[] = [
    { label: "Skin Type", value: skinDna.skinType },
    { label: "Primary Concern", value: skinDna.primaryConcern },
    {
      label: "Skin Sensitivity Index",
      value: skinDna.sensitivityIndex != null ? `${skinDna.sensitivityIndex}/10` : null,
    },
    { label: "UV Sensitivity", value: skinDna.uvSensitivity },
    { label: "Hormonal Correlation", value: skinDna.hormonalCorrelation },
  ];

  return (
    <View style={card.base}>
      <View style={s.headerBlock}>
        <View style={s.header}>
          <Text style={s.title}>Skin DNA snapshot</Text>
          {isNew ? (
            <View style={s.pill}>
              <Text style={s.pillText}>New</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.subtitle}>
          A quick read on your skin profile and recent scan parameters.
        </Text>
        {onViewScanReports ? (
          <Pressable style={s.scanReportsBtn} onPress={onViewScanReports}>
            <Text style={s.scanReportsText}>View scan reports</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      {rows.map((row, i) => (
        <View
          key={row.label}
          style={[s.row, i < rows.length - 1 && s.rowBorder]}
        >
          <Text style={s.label}>{row.label}</Text>
          <Text style={[s.value, { color: valueColor(row.value) }]}>
            {row.value ?? "—"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  headerBlock: { marginBottom: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  scanReportsBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0d9488",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanReportsText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
  },
  pill: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_LIGHT,
  },
  label: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
  },
});
