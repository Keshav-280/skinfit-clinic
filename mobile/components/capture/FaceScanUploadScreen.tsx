import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CapturePhotoGuideModal } from "@/components/capture/CapturePhotoGuideModal";
import { bottomDockInset } from "@/lib/bottomDockInset";
import { FACE_SCAN_CAPTURE_STEPS } from "@/lib/faceScanCaptures";
import {
  allFaceScanSlotsFilled,
  filledFaceScanSlotCount,
  FACE_SCAN_SLOT_COUNT,
  type FaceScanSlotUris,
} from "@/lib/faceScanSlotCaptures";
import {
  bulkPickIntoEmptySlots,
  pickMultipleFaceScanImages,
  pickSingleFaceScanImage,
} from "@/lib/pickFaceScanImages";
import { SKINFIT_GRADIENT, SKINFIT_THEME } from "@/lib/skinfitTheme";

const NAVY = SKINFIT_THEME.navy;
const NAVY_DARK = SKINFIT_THEME.navyDark;
const GREEN = "#4CAF50";

type Props = {
  slots: FaceScanSlotUris;
  onSlotsChange: (slots: FaceScanSlotUris) => void;
  onContinue: () => void;
  onStartCamera: () => void;
  onBack: () => void;
  reserveBottomDock?: boolean;
  title?: string;
};

export function FaceScanUploadScreen({
  slots,
  onSlotsChange,
  onContinue,
  onStartCamera,
  onBack,
  reserveBottomDock = false,
  title = "Upload photos",
}: Props) {
  const insets = useSafeAreaInsets();
  const dockInset = reserveBottomDock ? bottomDockInset() : 0;
  const [busy, setBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [photoGuideOpen, setPhotoGuideOpen] = useState(false);

  const filled = filledFaceScanSlotCount(slots);
  const complete = allFaceScanSlotsFilled(slots);

  async function pickForSlot(index: number) {
    setBusy(true);
    try {
      const uri = await pickSingleFaceScanImage();
      if (!uri) return;
      const next = [...slots];
      next[index] = uri;
      onSlotsChange(next);
      setUploadMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function pickMultiple() {
    const emptyCount = FACE_SCAN_SLOT_COUNT - filled;
    if (emptyCount <= 0) {
      setUploadMessage("All slots are filled — tap a photo to replace one.");
      return;
    }
    setBusy(true);
    try {
      const picked = await pickMultipleFaceScanImages(emptyCount);
      const result = bulkPickIntoEmptySlots(slots, picked);
      onSlotsChange(result.slots);
      setUploadMessage(result.message);
    } finally {
      setBusy(false);
    }
  }

  function clearSlot(index: number) {
    const next = [...slots];
    next[index] = null;
    onSlotsChange(next);
    setUploadMessage(null);
  }

  return (
    <LinearGradient colors={[...SKINFIT_GRADIENT.scan]} style={styles.root}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16) + dockInset,
          },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.topBarBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={NAVY} />
          </Pressable>
          <Text style={styles.topTitle}>{title}</Text>
          <Pressable
            onPress={() => setPhotoGuideOpen(true)}
            style={styles.topBarBtn}
            hitSlop={12}
          >
            <Ionicons name="help-circle-outline" size={26} color={NAVY} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={({ pressed }) => [styles.cameraCard, pressed && styles.cardPressed]}
            onPress={onStartCamera}
            disabled={busy}
          >
            <View style={styles.cameraIconWrap}>
              <Ionicons name="camera" size={28} color="#fff" />
            </View>
            <Text style={styles.cameraTitle}>Use device camera</Text>
            <Text style={styles.cameraSub}>
              Guided capture keeps the five angles in order.
            </Text>
            <View style={styles.cameraCta}>
              <Text style={styles.cameraCtaText}>Start camera scan</Text>
              <Ionicons name="arrow-forward" size={16} color={NAVY} />
            </View>
          </Pressable>

          <View style={styles.uploadCard}>
            <View style={styles.uploadIconWrap}>
              <Ionicons name="images-outline" size={26} color={NAVY} />
            </View>
            <Text style={styles.uploadTitle}>Upload photos</Text>
            <Text style={styles.uploadSub}>
              Tap each slot to add one photo, or choose several to fill empty slots.
            </Text>
            <Text style={styles.uploadCount}>
              {filled}/{FACE_SCAN_SLOT_COUNT} added
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.chooseBtn,
                pressed && styles.chooseBtnPressed,
                busy && styles.chooseBtnDisabled,
              ]}
              onPress={() => void pickMultiple()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color={NAVY} />
                  <Text style={styles.chooseBtnText}>Choose photos</Text>
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.checklistLabel}>Capture checklist</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.slotScroll}
          >
            {FACE_SCAN_CAPTURE_STEPS.map((step, index) => {
              const uri = slots[index];
              return (
                <View
                  key={step.id}
                  style={[styles.slot, uri ? styles.slotFilled : styles.slotEmpty]}
                >
                  {uri ? (
                    <>
                      <Pressable
                        onPress={() => void pickForSlot(index)}
                        style={styles.slotImageBtn}
                        disabled={busy}
                      >
                        <Image source={{ uri }} style={styles.slotImage} />
                      </Pressable>
                      <Pressable
                        onPress={() => clearSlot(index)}
                        style={styles.removeBtn}
                        hitSlop={6}
                        disabled={busy}
                      >
                        <Ionicons name="close" size={14} color="#64748B" />
                      </Pressable>
                      <Text style={styles.slotTitleFilled} numberOfLines={2}>
                        {step.title}
                      </Text>
                      <Pressable onPress={() => void pickForSlot(index)} disabled={busy}>
                        <Text style={styles.replaceLink}>Replace</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={styles.slotEmptyBtn}
                      onPress={() => void pickForSlot(index)}
                      disabled={busy}
                    >
                      <Text style={styles.slotNum}>{index + 1}</Text>
                      <Text style={styles.slotTitle}>{step.title}</Text>
                      <Text style={styles.slotHint}>Tap to upload</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {uploadMessage ? (
            <View style={styles.messageBanner}>
              <Text style={styles.messageText}>{uploadMessage}</Text>
            </View>
          ) : null}

          {complete ? (
            <Pressable
              style={({ pressed }) => [
                styles.continueBtn,
                pressed && styles.continueBtnPressed,
              ]}
              onPress={onContinue}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.continueBtnText}>Continue to preview</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <CapturePhotoGuideModal
        visible={photoGuideOpen}
        onClose={() => setPhotoGuideOpen(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 16 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
  },
  scroll: {
    paddingBottom: 24,
    gap: 16,
  },
  cameraCard: {
    borderRadius: 22,
    backgroundColor: NAVY,
    padding: 20,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.94 },
  cameraIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  cameraSub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
    maxWidth: 280,
  },
  cameraCta: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraCtaText: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY,
  },
  uploadCard: {
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(44,62,107,0.18)",
    backgroundColor: "rgba(255,255,255,0.55)",
    padding: 18,
    alignItems: "center",
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#E8EFE6",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
  },
  uploadSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 300,
  },
  uploadCount: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  chooseBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(44,62,107,0.15)",
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 160,
    justifyContent: "center",
  },
  chooseBtnPressed: { opacity: 0.9 },
  chooseBtnDisabled: { opacity: 0.6 },
  chooseBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: NAVY,
  },
  checklistLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(44,62,107,0.55)",
    marginTop: 4,
  },
  slotScroll: {
    gap: 10,
    paddingRight: 8,
  },
  slot: {
    width: 88,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    position: "relative",
  },
  slotEmpty: {
    borderColor: "rgba(44,62,107,0.15)",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  slotFilled: {
    borderColor: "rgba(76,175,80,0.35)",
    backgroundColor: "rgba(232,245,233,0.85)",
  },
  slotEmptyBtn: {
    alignItems: "center",
    width: "100%",
  },
  slotNum: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  slotTitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  slotHint: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "center",
  },
  slotImageBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
  },
  slotImage: {
    width: "100%",
    height: "100%",
  },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  slotTitleFilled: {
    marginTop: 6,
    fontSize: 9,
    fontWeight: "700",
    color: "#1E5E3A",
    textAlign: "center",
    lineHeight: 12,
  },
  replaceLink: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: NAVY,
    textDecorationLine: "underline",
  },
  messageBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#92400e",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: NAVY_DARK,
    borderRadius: 14,
    paddingVertical: 15,
  },
  continueBtnPressed: { opacity: 0.92 },
  continueBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
