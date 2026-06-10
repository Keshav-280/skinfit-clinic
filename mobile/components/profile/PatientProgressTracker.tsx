import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAVY, TEXT_MUTED } from "@/components/profile/theme";
import type {
  PatientProgressSnapshot,
  ProgressMilestone,
  ProgressMilestoneId,
} from "../../../src/lib/patientProgressMilestones";

const GREEN = "#4CAF50";
const MUTED = "#9CA3AF";

type Props = PatientProgressSnapshot;

const MOBILE_SHORT_LABELS: Record<ProgressMilestoneId, string> = {
  account: "Account",
  onboarding_scan: "Scan",
  questionnaire: "Survey",
  daily_journal: "Journal",
  clinic_visit: "Clinic",
};

function mobileMilestoneHref(id: ProgressMilestoneId): Href | null {
  switch (id) {
    case "account":
      return null;
    case "onboarding_scan":
      return "/onboarding/capture-intro";
    case "questionnaire":
      return "/onboarding/questionnaire?entry=resume";
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
        <Ionicons name="checkmark" size={11} color="#fff" />
      ) : (
        <Text style={[s.circleNum, (active || done) && s.circleNumLight]}>{index + 1}</Text>
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
  const lastIndex = milestones.length - 1;

  return (
    <View style={s.wrap} accessibilityLabel="Your progress">
      <View style={s.stepsRow}>
        {milestones.map((step, index) => {
          const done = step.done;
          const active = !done && index === activeIndex;
          // Server href is null when the step is locked (e.g. questionnaire
          // before the scan) — mirror web gating, but use native routes.
          const href = !done && step.href ? mobileMilestoneHref(step.id) : null;
          const labelStyle = done ? s.labelDone : active ? s.labelActive : s.labelPending;
          const label = MOBILE_SHORT_LABELS[step.id] ?? step.label;
          const prevDone = index > 0 ? milestones[index - 1]?.done : false;
          const isFirst = index === 0;
          const isLast = index === lastIndex;

          const labelNode = (
            <Text style={[s.label, labelStyle]} numberOfLines={2}>
              {label}
            </Text>
          );

          return (
            <View key={step.id} style={s.stepCol}>
              <View style={s.trackRow}>
                <View
                  style={[
                    s.connector,
                    isFirst ? s.connectorHidden : prevDone ? s.connectorDone : s.connectorPending,
                  ]}
                />
                <StepCircle
                  step={step}
                  index={index}
                  active={active}
                  onPress={href ? () => router.push(href) : undefined}
                />
                <View
                  style={[
                    s.connector,
                    isLast
                      ? s.connectorHidden
                      : done
                        ? s.connectorDone
                        : s.connectorPending,
                  ]}
                />
              </View>
              {href ? (
                <Pressable
                  onPress={() => router.push(href)}
                  hitSlop={4}
                  style={s.labelPress}
                >
                  {labelNode}
                </Pressable>
              ) : (
                <View style={s.labelPress}>{labelNode}</View>
              )}
            </View>
          );
        })}
      </View>

      {questionnaireUnlocks.length > 0 ? (
        <Text style={s.hint}>
          Complete questionnaire to unlock{" "}
          <Text style={s.hintBold}>{formatUnlockList(questionnaireUnlocks)}</Text>
          .{" "}
          <Text
            style={s.hintLink}
            onPress={() => router.push("/onboarding/questionnaire?entry=resume" as Href)}
          >
            Continue
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

const CIRCLE = 22;

const s = StyleSheet.create({
  wrap: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  stepsRow: {
    flexDirection: "row",
    width: "100%",
  },
  stepCol: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  connector: {
    flex: 1,
    height: 2,
    minWidth: 0,
    borderRadius: 1,
  },
  connectorHidden: {
    backgroundColor: "transparent",
  },
  connectorDone: {
    backgroundColor: GREEN,
  },
  connectorPending: {
    backgroundColor: "#E5E7EB",
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
  },
  circleNumLight: {
    color: "#fff",
  },
  labelPress: {
    marginTop: 6,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 1,
  },
  label: {
    textAlign: "center",
    fontSize: 8,
    fontWeight: "600",
    lineHeight: 11,
    width: "100%",
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
