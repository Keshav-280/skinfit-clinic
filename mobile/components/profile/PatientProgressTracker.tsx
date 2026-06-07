import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { card, NAVY, TEXT_MUTED } from "@/components/profile/theme";
import type {
  PatientProgressSnapshot,
  ProgressMilestone,
  ProgressMilestoneId,
} from "../../../src/lib/patientProgressMilestones";

const GREEN = "#4CAF50";
const MUTED = "#9CA3AF";

type Props = PatientProgressSnapshot;

function mobileMilestoneHref(id: ProgressMilestoneId): Href | null {
  switch (id) {
    case "account":
      return null;
    case "onboarding_scan":
      return "/onboarding/capture-intro";
    case "questionnaire":
      return "/onboarding/questionnaire";
    case "daily_journal":
      return "/(drawer)";
    case "clinic_visit":
      return "/(drawer)/schedules";
    default:
      return null;
  }
}

function formatUnlockList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
}

function StepCircle({
  step,
  index,
  active,
  onPress,
}: {
  step: ProgressMilestone;
  index: number;
  active: boolean;
  onPress?: () => void;
}) {
  const done = step.done;
  const circle = (
    <View
      style={[
        s.circle,
        done && s.circleDone,
        active && !done && s.circleActive,
        !done && !active && s.circlePending,
      ]}
    >
      {done ? (
        <Ionicons name="checkmark" size={14} color="#fff" />
      ) : (
        <Text
          style={[
            s.circleNum,
            (active || done) && s.circleNumLight,
          ]}
        >
          {index + 1}
        </Text>
      )}
    </View>
  );

  if (!onPress) return circle;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button">
      {circle}
    </Pressable>
  );
}

export default function PatientProgressTracker({
  milestones,
  allComplete,
  questionnaireUnlocks,
}: Props) {
  if (allComplete) return null;

  const activeIndex = milestones.findIndex((m) => !m.done);

  return (
    <View style={[card.base, s.wrap]} accessibilityLabel="Your progress">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {milestones.map((step, index) => {
          const done = step.done;
          const active = !done && index === activeIndex;
          const isLast = index === milestones.length - 1;
          const href = !done ? mobileMilestoneHref(step.id) : null;
          const labelStyle = done ? s.labelDone : active ? s.labelActive : s.labelPending;

          return (
            <View key={step.id} style={s.stepCol}>
              <View style={s.stepRow}>
                {index > 0 ? (
                  <View
                    style={[
                      s.connector,
                      milestones[index - 1]?.done ? s.connectorDone : s.connectorPending,
                    ]}
                  />
                ) : (
                  <View style={s.connectorSpacer} />
                )}
                <StepCircle
                  step={step}
                  index={index}
                  active={active}
                  onPress={href ? () => router.push(href) : undefined}
                />
                {!isLast ? (
                  <View
                    style={[s.connector, done ? s.connectorDone : s.connectorPending]}
                  />
                ) : (
                  <View style={s.connectorSpacer} />
                )}
              </View>
              {href ? (
                <Pressable onPress={() => router.push(href)} hitSlop={4}>
                  <Text style={[s.label, labelStyle]} numberOfLines={3}>
                    {step.label}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[s.label, labelStyle]} numberOfLines={3}>
                  {step.label}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {questionnaireUnlocks.length > 0 ? (
        <Text style={s.hint}>
          Complete questionnaire to unlock{" "}
          <Text style={s.hintBold}>{formatUnlockList(questionnaireUnlocks)}</Text>
          .{" "}
          <Text
            style={s.hintLink}
            onPress={() => router.push("/onboarding/questionnaire" as Href)}
          >
            Continue
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 16, paddingHorizontal: 12 },
  scrollContent: {
    minWidth: "100%",
    paddingHorizontal: 4,
  },
  stepCol: {
    width: 92,
    alignItems: "center",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  connector: {
    flex: 1,
    height: 1,
  },
  connectorDone: {
    backgroundColor: GREEN,
  },
  connectorPending: {
    backgroundColor: "#E5E7EB",
  },
  connectorSpacer: {
    flex: 1,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    borderColor: GREEN,
    backgroundColor: GREEN,
  },
  circleActive: {
    borderColor: NAVY,
    backgroundColor: NAVY,
  },
  circlePending: {
    borderColor: "#E5E7EB",
    backgroundColor: "transparent",
  },
  circleNum: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
  },
  circleNumLight: {
    color: "#fff",
  },
  label: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 12,
    paddingHorizontal: 2,
  },
  labelDone: {
    color: GREEN,
  },
  labelActive: {
    color: NAVY,
  },
  labelPending: {
    color: MUTED,
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: TEXT_MUTED,
  },
  hintBold: {
    fontWeight: "700",
    color: NAVY,
  },
  hintLink: {
    fontWeight: "700",
    color: NAVY,
    textDecorationLine: "underline",
  },
});
