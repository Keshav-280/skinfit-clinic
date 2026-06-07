import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import {
  applyImagesToEmptyFaceScanSlots,
  filledFaceScanSlotCount,
  FACE_SCAN_SLOT_COUNT,
  type FaceScanSlotUris,
} from "@/lib/faceScanSlotCaptures";

async function ensureLibraryPermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted) return true;
  Alert.alert("Photos", "Allow photo library access to choose images.");
  return false;
}

export async function pickSingleFaceScanImage(): Promise<string | null> {
  if (!(await ensureLibraryPermission())) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.88,
    allowsMultipleSelection: false,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return res.assets[0].uri;
}

export async function pickMultipleFaceScanImages(
  maxCount: number
): Promise<string[]> {
  if (!(await ensureLibraryPermission())) return [];
  const limit = Math.max(1, Math.min(maxCount, FACE_SCAN_SLOT_COUNT));
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.88,
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });
  if (res.canceled || !res.assets?.length) return [];
  return res.assets.map((a) => a.uri).filter(Boolean);
}

export type BulkPickResult = {
  slots: FaceScanSlotUris;
  message: string | null;
};

export function bulkPickIntoEmptySlots(
  slots: FaceScanSlotUris,
  pickedUris: string[]
): BulkPickResult {
  if (pickedUris.length === 0) {
    return { slots, message: null };
  }
  const emptyBefore = FACE_SCAN_SLOT_COUNT - filledFaceScanSlotCount(slots);
  if (emptyBefore === 0) {
    return {
      slots,
      message: "All slots are filled — tap a photo to replace one.",
    };
  }
  const { slots: next, added, skipped } = applyImagesToEmptyFaceScanSlots(
    slots,
    pickedUris
  );
  if (added === 0) {
    return { slots, message: "No empty slots to fill." };
  }
  if (skipped > 0) {
    return {
      slots: next,
      message: `Added ${added} photo${added === 1 ? "" : "s"}. ${skipped} extra file${skipped === 1 ? " was" : "s were"} skipped — tap a slot to replace.`,
    };
  }
  return { slots: next, message: null };
}
