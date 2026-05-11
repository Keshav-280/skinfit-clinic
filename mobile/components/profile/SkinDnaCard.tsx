import { View, Text, StyleSheet } from "react-native";
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
};

const POSITIVE_VALUES = new Set(["detected", "high", "yes"]);

function valueColor(value: string | null): string {
  if (!value) return TEXT_MUTED;
  return POSITIVE_VALUES.has(value.toLowerCase()) ? GREEN : NAVY;
}

type Row = { label: string; value: string | null };

export default function SkinDnaCard({ skinDna, isNew }: Props) {
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
      <View style={s.header}>
        <Text style={s.title}>Skin DNA Card</Text>
        {isNew && (
          <View style={s.pill}>
            <Text style={s.pillText}>New</Text>
          </View>
        )}
      </View>
      <Text style={s.subtitle}>Your unique skin identity</Text>

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
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
