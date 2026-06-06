import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_AGE_OPTIONS } from "../../../src/lib/onboardingAgeOptions";

const NAVY = "#2C3E6B";
const NAVY_DARK = "#1E3264";
const PLACEHOLDER = "#94a3b8";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function AgeDropdown({ value, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(value || "25");

  useEffect(() => {
    if (sheetOpen) {
      setDraft(value || "25");
    }
  }, [sheetOpen, value]);

  const displayLabel = value ? `${value} years old` : "Select your age";

  if (Platform.OS === "android") {
    return (
      <View style={[styles.field, value ? styles.fieldFilled : null]}>
        <Picker
          mode="dropdown"
          selectedValue={value || ""}
          onValueChange={(next) => onChange(next ? String(next) : "")}
          style={styles.androidPicker}
          dropdownIconColor={NAVY}
        >
          <Picker.Item label="Select your age" value="" color={PLACEHOLDER} />
          {ONBOARDING_AGE_OPTIONS.map((age) => (
            <Picker.Item key={age} label={`${age} years old`} value={String(age)} />
          ))}
        </Picker>
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={[styles.field, styles.trigger, value ? styles.fieldFilled : null]}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Select age"
      >
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={20} color={NAVY} />
      </Pressable>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setSheetOpen(false)} hitSlop={10}>
                <Text style={styles.sheetCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Your age</Text>
              <Pressable
                onPress={() => {
                  onChange(draft);
                  setSheetOpen(false);
                }}
                hitSlop={10}
              >
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
            <Picker
              selectedValue={draft}
              onValueChange={(next) => setDraft(String(next))}
              style={styles.iosPicker}
              itemStyle={styles.iosPickerItem}
            >
              {ONBOARDING_AGE_OPTIONS.map((age) => (
                <Picker.Item key={age} label={`${age} years old`} value={String(age)} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    overflow: "hidden",
    minHeight: 54,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  fieldFilled: {
    borderColor: NAVY,
    backgroundColor: "#F8FAFC",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  triggerText: {
    fontSize: 16,
    fontWeight: "600",
    color: NAVY_DARK,
  },
  triggerPlaceholder: {
    color: PLACEHOLDER,
    fontWeight: "500",
  },
  androidPicker: {
    width: "100%",
    color: NAVY_DARK,
    marginHorizontal: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sheetCancel: {
    fontSize: 16,
    color: "#71717a",
    fontWeight: "600",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY_DARK,
  },
  sheetDone: {
    fontSize: 16,
    color: NAVY,
    fontWeight: "700",
  },
  iosPicker: {
    width: "100%",
    height: 216,
  },
  iosPickerItem: {
    fontSize: 20,
    color: NAVY_DARK,
  },
});
