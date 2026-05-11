import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { card, NAVY, TEXT_PRIMARY, TEXT_MUTED, TEXT_LIGHT, BORDER_LIGHT } from "@/components/profile/theme";

type SkinIdentitySignals = {
  skinType?: string;
  primaryConcern?: string;
  sensitivityIndex?: string;
  uvSensitivity?: string;
  hormonalCorrelation?: string;
};

type SkinIdentity = {
  asOfDate: string;
  skinType: string | null;
  primaryConcern: string | null;
  sensitivityIndex: number | null;
  uvSensitivity: string | null;
  hormonalCorrelation: string | null;
  signals: SkinIdentitySignals;
  dataDepth: { scansConsidered: number; logsConsidered: number };
};

type Props = {
  userName: string;
  timeline: {
    initial: SkinIdentity;
    current: SkinIdentity;
    changed: Array<{ field: string; from: string | number | null; to: string | number | null }>;
  };
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  skinType: "color-filter-outline",
  primaryConcern: "locate-outline",
  sensitivityIndex: "water-outline",
  uvSensitivity: "sunny-outline",
  hormonalCorrelation: "pulse-outline",
};

const LABEL_MAP: Record<string, string> = {
  skinType: "Skin Type",
  primaryConcern: "Primary Concern",
  sensitivityIndex: "Sensitivity Index",
  uvSensitivity: "UV Sensitivity",
  hormonalCorrelation: "Hormonal Correlation",
};

const FIELD_KEYS = [
  "skinType",
  "primaryConcern",
  "sensitivityIndex",
  "uvSensitivity",
  "hormonalCorrelation",
] as const;

function displayVal(v: string | number | null): string {
  if (v == null) return "—";
  return String(v);
}

function isEvolved(
  field: string,
  changed: Props["timeline"]["changed"],
): boolean {
  return changed.some((c) => c.field === field);
}

function FieldCard({
  field,
  initialVal,
  currentVal,
  evolved,
  rationale,
}: {
  field: string;
  initialVal: string | number | null;
  currentVal: string | number | null;
  evolved: boolean;
  rationale: string | undefined;
}) {
  const iconName = ICON_MAP[field] ?? "ellipse-outline";
  const label = LABEL_MAP[field] ?? field;

  return (
    <View style={s.fieldCard}>
      <View style={s.fieldTop}>
        <View style={s.iconCircle}>
          <Ionicons name={iconName as any} size={16} color="#fff" />
        </View>
        <Text style={s.fieldLabel}>{label.toUpperCase()}</Text>
        <View style={[s.badge, evolved ? s.badgeEvolved : s.badgeStable]}>
          <Text style={[s.badgeText, evolved ? s.badgeTextEvolved : s.badgeTextStable]}>
            {evolved ? "Evolved" : "Stable"}
          </Text>
        </View>
      </View>

      <View style={s.valRow}>
        <Text style={s.valText}>{displayVal(initialVal)}</Text>
        <Ionicons name="arrow-forward" size={14} color={TEXT_LIGHT} style={s.arrow} />
        <Text style={[s.valText, s.valCurrent]}>{displayVal(currentVal)}</Text>
      </View>

      {rationale ? (
        <Text style={s.rationale}>
          <Text style={s.rationaleKey}>why: </Text>
          {rationale}
        </Text>
      ) : null}
    </View>
  );
}

export default function SkinIdentityCard({ userName, timeline }: Props) {
  const { initial, current, changed } = timeline;
  const evolvedCount = changed.length;
  const dateRange = `${initial.asOfDate} — ${current.asOfDate}`;

  return (
    <View style={card.base}>
      <Text style={s.kicker}>SKIN IDENTITY CARD</Text>
      <Text style={s.title}>{userName}'s Skin DNA</Text>
      <Text style={s.meta}>{dateRange}</Text>

      {evolvedCount > 0 && (
        <View style={s.evolvedPill}>
          <Text style={s.evolvedPillText}>{evolvedCount} field{evolvedCount !== 1 ? "s" : ""} evolved</Text>
        </View>
      )}

      <View style={s.fields}>
        {FIELD_KEYS.map((key) => {
          const initVal = initial[key];
          const curVal = current[key];
          const rationale = current.signals[key];
          return (
            <FieldCard
              key={key}
              field={key}
              initialVal={initVal}
              currentVal={curVal}
              evolved={isEvolved(key, changed)}
              rationale={rationale}
            />
          );
        })}
      </View>

      {changed.length > 0 && (
        <View style={s.changedSection}>
          <Text style={s.changedTitle}>Changed since {initial.asOfDate}</Text>
          {changed.map((c, i) => (
            <View key={i} style={s.changedRow}>
              <Text style={s.changedField}>{LABEL_MAP[c.field] ?? c.field}</Text>
              <Text style={s.changedVal}>
                {displayVal(c.from)} → {displayVal(c.to)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  meta: {
    fontSize: 13,
    color: TEXT_LIGHT,
    marginBottom: 10,
  },

  evolvedPill: {
    alignSelf: "flex-start",
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
  },
  evolvedPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },

  fields: {
    gap: 10,
  },
  fieldCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  fieldTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MUTED,
    letterSpacing: 0.6,
    flex: 1,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeEvolved: {
    backgroundColor: "#dcfce7",
  },
  badgeStable: {
    backgroundColor: "#f1f5f9",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgeTextEvolved: {
    color: "#166534",
  },
  badgeTextStable: {
    color: TEXT_LIGHT,
  },

  valRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  valText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_MUTED,
  },
  valCurrent: {
    color: TEXT_PRIMARY,
  },
  arrow: {
    marginHorizontal: 8,
  },

  rationale: {
    fontSize: 13,
    color: TEXT_LIGHT,
    lineHeight: 18,
  },
  rationaleKey: {
    fontWeight: "600",
    color: TEXT_MUTED,
  },

  changedSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 14,
  },
  changedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
  },
  changedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_LIGHT,
  },
  changedField: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  changedVal: {
    fontSize: 13,
    color: TEXT_MUTED,
  },
});
