import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CaptureExtraTipsModal } from "@/components/capture/CaptureExtraTipsModal";
import { getCaptureViewfinderSize } from "@/lib/captureViewfinderSize";
import type { FaceScanCaptureId } from "@/lib/faceScanCaptures";
import {
  CAPTURE_GUIDANCE_WARMUP_MESSAGE,
  LIGHTING_SCORE_READY_THRESHOLD,
  type CaptureGuidanceSnapshot,
} from "@/lib/scanCaptureGuidance";
import {
  CAPTURE_VOICE_VOLUME_MAX,
  CAPTURE_VOICE_VOLUME_MIN,
} from "@/lib/captureVoiceVolume";
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

function VoiceVolumeSlider({
  value,
  onChange,
  onDragStart,
  onDragEnd,
  compact = false,
  style,
}: {
  value: number;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  compact?: boolean;
  style?: object;
}) {
  const trackWidth = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  function computeValue(x: number) {
    const w = trackWidth.current;
    if (w <= 0) return value;
    const ratio = Math.max(0, Math.min(1, x / w));
    const next =
      CAPTURE_VOICE_VOLUME_MIN +
      ratio * (CAPTURE_VOICE_VOLUME_MAX - CAPTURE_VOICE_VOLUME_MIN);
    return Math.round(next * 100) / 100;
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          onDragStartRef.current?.();
          onChangeRef.current(computeValue(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => {
          onChangeRef.current(computeValue(e.nativeEvent.locationX));
        },
        onPanResponderRelease: () => {
          onDragEndRef.current?.();
        },
        onPanResponderTerminate: () => {
          onDragEndRef.current?.();
        },
      }),
    []
  );

  const span = CAPTURE_VOICE_VOLUME_MAX - CAPTURE_VOICE_VOLUME_MIN;
  const ratio = span > 0 ? (value - CAPTURE_VOICE_VOLUME_MIN) / span : 0;

  return (
    <View style={[voiceVolumeStyles.row, compact && voiceVolumeStyles.rowCompact, style]}>
      {!compact ? <Ionicons name="volume-mute" size={16} color={MUTED} /> : null}
      <View
        style={voiceVolumeStyles.track}
        onLayout={(e: LayoutChangeEvent) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={voiceVolumeStyles.trackFill} />
        <View
          style={[voiceVolumeStyles.thumb, { left: `${ratio * 100}%` }]}
          pointerEvents="none"
        />
      </View>
      {!compact ? <Ionicons name="volume-high" size={16} color={MUTED} /> : null}
    </View>
  );
}

const voiceVolumeStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  rowCompact: {
    flex: 1,
    minWidth: 72,
    gap: 6,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  track: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(30, 27, 49, 0.18)",
  },
  thumb: {
    position: "absolute",
    top: "50%",
    marginTop: -8,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NAVY,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});

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
  voiceVolume: number;
  onVoiceVolumeChange: (value: number) => void;
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
  /** Split light + distance rows (matches web WebCaptureStepShell). */
  guidance?: CaptureGuidanceSnapshot | null;
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
  voiceVolume,
  onVoiceVolumeChange,
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
  guidance,
  showExtraTipsHelp = true,
}: Props) {
  const [extraTipsOpen, setExtraTipsOpen] = useState(false);
  const [volumeDragging, setVolumeDragging] = useState(false);
  // Tips overlay: show on the camera feed for 2s on each step, then smoothly
  // collapse to a small "Tips" pill the user can tap to bring them back.
  const [tipsOpen, setTipsOpen] = useState(true);
  const tipsAnim = useRef(new Animated.Value(1)).current;
  const tipsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setTipsOpen(true);
  }, [stepIndex]);

  useEffect(() => {
    Animated.timing(tipsAnim, {
      toValue: tipsOpen ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
    if (!tipsOpen) return;
    if (tipsTimer.current) clearTimeout(tipsTimer.current);
    tipsTimer.current = setTimeout(() => setTipsOpen(false), 2000);
    return () => {
      if (tipsTimer.current) clearTimeout(tipsTimer.current);
    };
  }, [tipsOpen, tipsAnim]);
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
          {showVoiceToggle && voiceAvailable ? (
            <>
              <Pressable
                onPress={onToggleVoice}
                style={[styles.iconBtn, voiceEnabled && styles.iconBtnActive]}
                hitSlop={8}
                accessibilityLabel={voiceEnabled ? "Mute voice guide" : "Unmute voice guide"}
              >
                <Ionicons
                  name={voiceEnabled ? "volume-high" : "volume-mute"}
                  size={20}
                  color={voiceEnabled ? "#FFFFFF" : NAVY}
                />
              </Pressable>
              {voiceEnabled ? (
                <VoiceVolumeSlider
                  compact
                  value={voiceVolume}
                  onChange={onVoiceVolumeChange}
                  onDragStart={() => setVolumeDragging(true)}
                  onDragEnd={() => setVolumeDragging(false)}
                  style={styles.voiceSliderInline}
                />
              ) : null}
            </>
          ) : null}
          <View style={styles.topActions}>
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

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!volumeDragging}
          keyboardShouldPersistTaps="handled"
        >
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
            {!reviewingCapture ? (
              <>
                <Animated.View
                  pointerEvents={tipsOpen ? "auto" : "none"}
                  style={[
                    styles.tipsOverlay,
                    {
                      opacity: tipsAnim,
                      transform: [
                        {
                          translateY: tipsAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    style={styles.tipsOverlayInner}
                    onPress={() => setTipsOpen(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Hide tips"
                  >
                    <Text style={styles.tipsOverlayHeading}>Tips</Text>
                    {step.tips.map((tip) => (
                      <View key={tip} style={styles.tipsOverlayRow}>
                        <View style={styles.tipsOverlayBullet} />
                        <Text style={styles.tipsOverlayText}>{tip}</Text>
                      </View>
                    ))}
                  </Pressable>
                </Animated.View>
                <Animated.View
                  pointerEvents={tipsOpen ? "none" : "auto"}
                  style={[
                    styles.tipsFab,
                    {
                      opacity: tipsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                    },
                  ]}
                >
                  <Pressable
                    style={styles.tipsFabBtn}
                    onPress={() => setTipsOpen(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Show tips"
                  >
                    <Ionicons name="bulb-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.tipsFabText}>Tips</Text>
                  </Pressable>
                </Animated.View>
              </>
            ) : null}
          </View>
        </View>

        {!reviewingCapture && showGuidanceBanner ? (
          guidance !== undefined ? (
            <CaptureGuidanceStatusBoxes guidance={guidance} ready={guidanceReady} />
          ) : (
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
          )
        ) : null}

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
        </ScrollView>
      </View>

      <CaptureExtraTipsModal
        visible={extraTipsOpen}
        onClose={() => setExtraTipsOpen(false)}
      />
    </View>
  );
}

function CaptureGuidanceStatusBoxes({
  guidance,
  ready,
}: {
  guidance: CaptureGuidanceSnapshot | null;
  ready: boolean;
}) {
  if (!guidance) {
    return (
      <View style={styles.guideWarmup}>
        <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
        <Text style={styles.guideWarmupText}>{CAPTURE_GUIDANCE_WARMUP_MESSAGE}</Text>
      </View>
    );
  }

  const lightingOk =
    guidance.lighting === "good" ||
    guidance.lightingScore >= LIGHTING_SCORE_READY_THRESHOLD;
  const faceOk = guidance.face === "good";

  return (
    <View style={styles.guideSplitWrap}>
      <GuidanceStatusRow
        ok={lightingOk}
        label="Light"
        message={lightingOk ? "Lighting looks good" : guidance.lightingMessage}
        icon="sunny-outline"
      />
      <GuidanceStatusRow
        ok={faceOk}
        label="Distance"
        message={faceOk ? "Nicely framed" : guidance.faceMessage}
        icon="move-outline"
      />
      {ready ? (
        <Text style={styles.guideReadyHint}>Ready — tap Capture when you're set.</Text>
      ) : null}
    </View>
  );
}

function GuidanceStatusRow({
  ok,
  label,
  message,
  icon,
}: {
  ok: boolean;
  label: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.guideRow, ok ? styles.guideRowOk : styles.guideRowWarn]}>
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle-outline"}
        size={18}
        color={ok ? "#059669" : "#f59e0b"}
      />
      <View style={styles.guideRowBody}>
        <Text style={[styles.guideRowLabel, ok && styles.guideRowLabelOk]}>{label}</Text>
        <Text style={styles.guideRowMessage}>{message}</Text>
      </View>
      <Ionicons name={icon} size={16} color={NAVY} style={styles.guideRowIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
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
    minWidth: 48,
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
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  voiceSliderInline: {
    flex: 1,
    minWidth: 64,
    maxWidth: 112,
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
  guideWarmup: {
    marginTop: 12,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(224, 112, 136, 0.35)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  guideWarmupText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
    color: NAVY,
  },
  guideSplitWrap: {
    marginTop: 12,
    gap: 8,
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  guideRowOk: {
    borderColor: "rgba(16,185,129,0.35)",
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  guideRowWarn: {
    borderColor: "rgba(224, 112, 136, 0.4)",
  },
  guideRowBody: {
    flex: 1,
    minWidth: 0,
  },
  guideRowLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: ACCENT,
  },
  guideRowLabelOk: {
    color: "#059669",
  },
  guideRowMessage: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
    color: NAVY,
  },
  guideRowIcon: {
    marginTop: 2,
    opacity: 0.85,
  },
  guideReadyHint: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
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
  tipsOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  tipsOverlayInner: {
    backgroundColor: "rgba(17, 24, 39, 0.62)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  tipsOverlayHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#FBCFE8",
    marginBottom: 2,
  },
  tipsOverlayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipsOverlayBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT,
    marginTop: 6,
  },
  tipsOverlayText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "500",
  },
  tipsFab: {
    position: "absolute",
    left: 10,
    bottom: 10,
  },
  tipsFabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(17, 24, 39, 0.6)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tipsFabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
