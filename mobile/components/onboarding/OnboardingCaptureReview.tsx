import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CapturePhotoDebugModal } from "@/components/capture/CapturePhotoDebugModal";
import { isCaptureDebugTapEnabled } from "@/components/ScanCaptureDebugOverlay";

import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const MUTED = "#5C6478";
const ACCENT_LINK = "#4A5FC1";

type Props = {
  uris: string[];
  busy?: boolean;
  onBack: () => void;
  onLooksGood: () => void;
  onRetakeIndex: (index: number) => void;
  primaryLabel?: string;
  scanName?: string;
  onScanNameChange?: (name: string) => void;
  scanNamePlaceholder?: string;
};

function PhotoTile({
  uri,
  label,
  onPress,
  debugTap,
}: {
  uri: string;
  label: string;
  onPress: () => void;
  debugTap?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={debugTap ? `Debug ${label}` : `Retake ${label}`}
    >
      <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
      <View style={styles.checkBadge}>
        <Ionicons name="checkmark" size={14} color="#fff" />
      </View>
    </Pressable>
  );
}

export function OnboardingCaptureReview({
  uris,
  busy,
  onBack,
  onLooksGood,
  onRetakeIndex,
  primaryLabel = "Looks Good",
  scanName,
  onScanNameChange,
  scanNamePlaceholder,
}: Props) {
  const insets = useSafeAreaInsets();
  const debugTap = isCaptureDebugTapEnabled();
  const [debugPhoto, setDebugPhoto] = useState<{
    uri: string;
    label: string;
    index: number;
  } | null>(null);

  function handleTilePress(index: number, uri: string, label: string) {
    if (debugTap) {
      setDebugPhoto({ uri, label, index });
      return;
    }
    onRetakeIndex(index);
  }

  function promptRetakeAny() {
    Alert.alert(
      "Retake a photo",
      "Choose which angle to capture again.",
      [
        ...FACE_SCAN_CAPTURE_STEPS.map((step, index) => ({
          text: step.title,
          onPress: () => onRetakeIndex(index),
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
      { cancelable: true }
    );
  }

  const topRow = uris.slice(0, 3);
  const bottomRow = uris.slice(3, 5);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Review Photos</Text>
          <Text style={styles.subtitle}>
            Please make sure all photos are clear and meet the requirements.
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoGrid}>
          <View style={styles.row}>
            {topRow.map((uri, i) => (
              <PhotoTile
                key={FACE_SCAN_CAPTURE_STEPS[i].id}
                uri={uri}
                label={FACE_SCAN_CAPTURE_STEPS[i].title}
                debugTap={debugTap}
                onPress={() =>
                  handleTilePress(i, uri, FACE_SCAN_CAPTURE_STEPS[i].title)
                }
              />
            ))}
          </View>
          <View style={[styles.row, styles.rowBottom]}>
            {bottomRow.map((uri, i) => {
              const index = i + 3;
              return (
                <PhotoTile
                  key={FACE_SCAN_CAPTURE_STEPS[index].id}
                  uri={uri}
                  label={FACE_SCAN_CAPTURE_STEPS[index].title}
                  debugTap={debugTap}
                  onPress={() =>
                    handleTilePress(
                      index,
                      uri,
                      FACE_SCAN_CAPTURE_STEPS[index].title
                    )
                  }
                />
              );
            })}
          </View>
        </View>

        {onScanNameChange ? (
          <View style={styles.scanNameCard}>
            <Text style={styles.scanNameLabel}>Name this scan</Text>
            <TextInput
              style={styles.scanNameInput}
              placeholder={scanNamePlaceholder}
              placeholderTextColor="#9CA3AF"
              value={scanName ?? ""}
              onChangeText={onScanNameChange}
              maxLength={255}
              returnKeyType="done"
              autoCorrect={false}
              editable={!busy}
            />
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            busy && styles.primaryBtnDisabled,
            pressed && !busy && styles.primaryBtnPressed,
          ]}
          onPress={onLooksGood}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={promptRetakeAny}
          disabled={busy}
          style={styles.retakeLink}
          accessibilityRole="button"
        >
          <Text style={[styles.retakeLinkText, busy && styles.retakeLinkDisabled]}>
            Retake Any Photo
          </Text>
        </Pressable>
      </ScrollView>

      <CapturePhotoDebugModal
        visible={debugPhoto != null}
        uri={debugPhoto?.uri ?? ""}
        label={debugPhoto?.label ?? ""}
        onClose={() => setDebugPhoto(null)}
        onRetake={
          debugPhoto
            ? () => {
                const index = debugPhoto.index;
                setDebugPhoto(null);
                onRetakeIndex(index);
              }
            : undefined
        }
      />
    </View>
  );
}

const TILE_GAP = 10;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    paddingTop: 2,
  },
  headerText: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: NAVY,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: "center",
    maxWidth: 300,
  },
  scroll: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  photoGrid: {
    marginTop: 8,
    gap: TILE_GAP,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: TILE_GAP,
  },
  rowBottom: {
    paddingHorizontal: "12%",
  },
  tile: {
    flex: 1,
    maxWidth: 108,
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E8EAEF",
  },
  tilePressed: {
    opacity: 0.88,
  },
  tileImage: {
    width: "100%",
    height: "100%",
  },
  checkBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: NAVY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnPressed: {
    backgroundColor: NAVY_DARK,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  scanNameCard: {
    marginTop: 20,
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scanNameLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 8,
  },
  scanNameInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: NAVY,
  },
  retakeLink: {
    marginTop: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  retakeLinkText: {
    color: ACCENT_LINK,
    fontSize: 15,
    fontWeight: "600",
  },
  retakeLinkDisabled: {
    opacity: 0.45,
  },
});
