import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureExtraTipsModal } from "@/components/capture/CaptureExtraTipsModal";
import { getCaptureViewfinderSize } from "@/lib/captureViewfinderSize";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const BG = "#F6F5F2";
const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const MUTED = "#6B7280";
const ACCENT = "#E07088";
const ACCENT_SOFT = "rgba(224, 112, 136, 0.22)";
const ACCENT_BORDER_READY = "rgba(224, 112, 136, 0.45)";
const ACCENT_BG_READY = "rgba(224, 112, 136, 0.14)";

type StepMeta = {
  id: FaceScanCaptureId;
  title: string;
  subtitle: string;
  tips: readonly string[];
};

type Props = {
  step: StepMeta;
  stepIndex: number;
  totalSteps: number;
  viewfinder: ReactNode;
  previousCaptureUri?: string | null;
  reviewingCapture: boolean;
  shooting: boolean;
  shutterDisabled: boolean;
  guidanceMessage: string;
  guidanceReady?: boolean;
  voiceEnabled: boolean;
  voiceAvailable: boolean;
  onToggleVoice: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
  onBack: () => void;
  onShutter: () => void;
  onFlip: () => void;
  onRetake: () => void;
  onConfirm: () => void;
  isLastStep: boolean;
  onPickFromLibrary?: () => void;
  cameraReady?: boolean;
  /** Bug icon + capture debug overlay toggle (opt-in via env). */
  showDevControls?: boolean;
  /** Mute/unmute voice guide in the header (independent of debug). */
  showVoiceToggle?: boolean;
  /** Live framing/lighting hint below the viewfinder. */
  showGuidanceBanner?: boolean;
  /** Header ? button opens extra tips during live capture. */
  showExtraTipsHelp?: boolean;
};

export function OnboardingCaptureStepUI({
  step,
  stepIndex,
  totalSteps,
  viewfinder,
  previousCaptureUri,
  reviewingCapture,
  shooting,
  shutterDisabled,
  guidanceMessage,
  guidanceReady = false,
  voiceEnabled,
  voiceAvailable,
  onToggleVoice,
  showDebug,
  onToggleDebug,
  onBack,
  onShutter,
  onFlip,
  onRetake,
  onConfirm,
  isLastStep,
  onPickFromLibrary,
  cameraReady = true,
  showDevControls = false,
  showVoiceToggle = true,
  showGuidanceBanner = true,
  showExtraTipsHelp = true,
}: Props) {
  const [extraTipsOpen, setExtraTipsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const progress = (stepIndex + 1) / totalSteps;
  const { width: screenW, height: screenH } = Dimensions.get("window");
  const viewfinderSize = useMemo(
    () =>
      getCaptureViewfinderSize(insets.top + 8, Math.max(insets.bottom, 16), {
        width: screenW,
        height: screenH,
      }),
    [screenW, screenH, insets.top, insets.bottom]
  );

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={NAVY} />
          </Pressable>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.topActions}>
            {showVoiceToggle && voiceAvailable ? (
              <Pressable
                onPress={onToggleVoice}
                style={styles.iconBtn}
                hitSlop={8}
                accessibilityLabel={voiceEnabled ? "Mute voice guide" : "Unmute voice guide"}
              >
                <Ionicons
                  name={voiceEnabled ? "volume-high" : "volume-mute"}
                  size={20}
                  color={NAVY}
                />
              </Pressable>
            ) : null}
            {showDevControls ? (
              <Pressable
                onPress={onToggleDebug}
                style={[styles.iconBtn, showDebug && styles.iconBtnActive]}
                hitSlop={8}
                accessibilityLabel={showDebug ? "Hide debug panel" : "Show debug panel"}
              >
                <Ionicons name="bug-outline" size={19} color={showDebug ? "#FFFFFF" : NAVY} />
              </Pressable>
            ) : null}
            {showExtraTipsHelp && !reviewingCapture ? (
              <Pressable
                onPress={() => setExtraTipsOpen(true)}
                style={styles.iconBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Extra capture tips"
              >
                <Ionicons name="help-circle-outline" size={22} color={NAVY} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.stepCount}>
          {stepIndex + 1} of {totalSteps}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        <View style={styles.viewfinderWrap}>
          <View
            style={[
              styles.viewfinder,
              { width: viewfinderSize.width, height: viewfinderSize.height },
            ]}
            collapsable={false}
          >
            {viewfinder}
          </View>
        </View>

        {!reviewingCapture && showGuidanceBanner ? (
          <View style={[styles.guidePill, guidanceReady && styles.guidePillReady]}>
            <Ionicons
              name={guidanceReady ? "checkmark-circle" : "information-circle-outline"}
              size={18}
              color={ACCENT}
            />
            <Text style={styles.guideText} numberOfLines={2}>
              {guidanceMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsHeading}>Tips</Text>
          {step.tips.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {reviewingCapture ? (
          <View style={styles.reviewActions}>
            <Pressable
              style={({ pressed }) => [styles.reviewBtnOutline, pressed && styles.pressed]}
              onPress={onRetake}
            >
              <Text style={styles.reviewBtnOutlineText}>Retake</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.reviewBtnPrimary, pressed && styles.pressed]}
              onPress={onConfirm}
            >
              <Text style={styles.reviewBtnPrimaryText}>
                {isLastStep ? "Use photo & finish" : "Use photo & next"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable
              style={styles.thumbSlot}
              disabled={!previousCaptureUri}
              accessibilityLabel="Previous capture preview"
            >
              {previousCaptureUri ? (
                <Image source={{ uri: previousCaptureUri }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="image-outline" size={18} color="#9CA3AF" />
                </View>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.shutterOuter,
                shutterDisabled && styles.shutterDisabled,
                pressed && !shutterDisabled && styles.pressed,
              ]}
              onPress={onShutter}
              disabled={shutterDisabled}
              accessibilityLabel="Take photo"
            >
              {shooting ? (
                <ActivityIndicator color={ACCENT} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.flipBtn, pressed && styles.pressed]}
              onPress={onFlip}
              accessibilityLabel="Switch camera"
            >
              <Ionicons name="camera-reverse-outline" size={24} color={NAVY} />
            </Pressable>
          </View>
        )}

        {!reviewingCapture && onPickFromLibrary && !cameraReady ? (
          <Pressable style={styles.libraryLink} onPress={onPickFromLibrary}>
            <Ionicons name="images-outline" size={16} color={MUTED} />
            <Text style={styles.libraryLinkText}>Pick from library instead</Text>
          </Pressable>
        ) : null}
      </View>

      <CaptureExtraTipsModal
        visible={extraTipsOpen}
        onClose={() => setExtraTipsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  backBtn: {
    width: 28,
    alignItems: "flex-start",
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: ACCENT_SOFT,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 40,
    justifyContent: "flex-end",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(26,39,68,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  guidePill: {
    marginTop: 12,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(224, 112, 136, 0.25)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guidePillReady: {
    borderColor: ACCENT_BORDER_READY,
    backgroundColor: ACCENT_BG_READY,
  },
  guideText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    color: NAVY,
  },
  stepCount: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: NAVY,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
  },
  viewfinderWrap: {
    marginTop: 10,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  viewfinder: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1F2937",
    position: "relative",
  },
  tipsCard: {
    marginTop: 4,
    gap: 6,
    flexShrink: 0,
    paddingBottom: 4,
  },
  tipsHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 2,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  thumbSlot: {
    width: 52,
    height: 52,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(26,39,68,0.1)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: ACCENT,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  shutterDisabled: { opacity: 0.45 },
  flipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(26,39,68,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
  },
  reviewBtnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  reviewBtnOutlineText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "700",
  },
  reviewBtnPrimary: {
    flex: 1.2,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  reviewBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: { opacity: 0.9 },
  libraryLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
  },
  libraryLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
});
