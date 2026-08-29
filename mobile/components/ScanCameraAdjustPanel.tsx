import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  BRIGHTNESS_STEP,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_STEP,
  DEFAULT_CAMERA_ADJUSTMENTS,
  EXPOSURE_MAX,
  EXPOSURE_MIN,
  EXPOSURE_STEP,
  type CameraAdjustments,
} from "@/lib/cameraCaptureAdjustments";

type Props = {
  value: CameraAdjustments;
  onChange: (next: CameraAdjustments) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  disabled?: boolean;
  insetTop?: number;
  insetBottom?: number;
};

function fmtZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

function AdjustRow({
  label,
  display,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
}: {
  label: string;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControls}>
        <Pressable
          style={[styles.miniBtn, minusDisabled && styles.miniBtnDisabled]}
          onPress={onMinus}
          disabled={minusDisabled}
          hitSlop={6}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons name="remove" size={14} color="#fff" />
        </Pressable>
        <Text style={styles.rowValue}>{display}</Text>
        <Pressable
          style={[styles.miniBtn, plusDisabled && styles.miniBtnDisabled]}
          onPress={onPlus}
          disabled={plusDisabled}
          hitSlop={6}
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons name="add" size={14} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

export function ScanCameraAdjustPanel({
  value,
  onChange,
  expanded,
  onToggleExpanded,
  disabled,
  insetTop = 0,
  insetBottom = 0,
}: Props) {
  const patch = (partial: Partial<CameraAdjustments>) =>
    onChange({ ...value, ...partial });

  const changed =
    value.zoom !== 0 ||
    value.brightness !== 0 ||
    value.exposure !== 0 ||
    value.torch;

  return (
    <View
      style={[
        styles.wrap,
        { top: insetTop + 140, bottom: insetBottom + 150 },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[styles.toggleBtn, expanded && styles.toggleBtnOpen, changed && styles.toggleBtnActive]}
        onPress={onToggleExpanded}
        disabled={disabled}
        accessibilityLabel={expanded ? "Hide camera controls" : "Show camera controls"}
      >
        <Ionicons name="options-outline" size={18} color="#fff" />
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <AdjustRow
            label="Zoom"
            display={fmtZoom(value.zoom)}
            onMinus={() =>
              patch({ zoom: Math.max(CAMERA_ZOOM_MIN, value.zoom - CAMERA_ZOOM_STEP) })
            }
            onPlus={() =>
              patch({ zoom: Math.min(CAMERA_ZOOM_MAX, value.zoom + CAMERA_ZOOM_STEP) })
            }
            minusDisabled={disabled || value.zoom <= CAMERA_ZOOM_MIN}
            plusDisabled={disabled || value.zoom >= CAMERA_ZOOM_MAX}
          />
          <AdjustRow
            label="Bright"
            display={value.brightness > 0 ? `+${value.brightness}` : `${value.brightness}`}
            onMinus={() =>
              patch({
                brightness: Math.max(BRIGHTNESS_MIN, value.brightness - BRIGHTNESS_STEP),
              })
            }
            onPlus={() =>
              patch({
                brightness: Math.min(BRIGHTNESS_MAX, value.brightness + BRIGHTNESS_STEP),
              })
            }
            minusDisabled={disabled || value.brightness <= BRIGHTNESS_MIN}
            plusDisabled={disabled || value.brightness >= BRIGHTNESS_MAX}
          />
          <AdjustRow
            label="Exp"
            display={value.exposure > 0 ? `+${value.exposure}` : `${value.exposure}`}
            onMinus={() =>
              patch({
                exposure: Math.max(EXPOSURE_MIN, value.exposure - EXPOSURE_STEP),
              })
            }
            onPlus={() =>
              patch({
                exposure: Math.min(EXPOSURE_MAX, value.exposure + EXPOSURE_STEP),
              })
            }
            minusDisabled={disabled || value.exposure <= EXPOSURE_MIN}
            plusDisabled={disabled || value.exposure >= EXPOSURE_MAX}
          />

          <Pressable
            style={[styles.torchRow, value.torch && styles.torchRowOn]}
            onPress={() => patch({ torch: !value.torch })}
            disabled={disabled}
          >
            <Ionicons
              name={value.torch ? "flashlight" : "flashlight-outline"}
              size={15}
              color={value.torch ? "#fde68a" : "#fff"}
            />
            <Text style={styles.torchText}>Light</Text>
          </Pressable>

          {changed ? (
            <Pressable
              style={styles.resetBtn}
              onPress={() => onChange({ ...DEFAULT_CAMERA_ADJUSTMENTS })}
              disabled={disabled}
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 10,
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 12,
    gap: 8,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnOpen: {
    backgroundColor: "rgba(30, 27, 49,0.88)",
  },
  toggleBtnActive: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  panel: {
    width: 132,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    gap: 4,
  },
  rowLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
  },
  rowControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  miniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniBtnDisabled: {
    opacity: 0.35,
  },
  rowValue: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  torchRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  torchRowOn: {
    backgroundColor: "rgba(251,191,36,0.18)",
  },
  torchText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  resetBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    textDecorationLine: "underline",
  },
});
