import { StyleSheet } from "react-native";

export const NAVY = "#2B3A67";
export const GREEN = "#1B8A4A";
export const BG_GRADIENT: [string, string] = ["#E8EFE6", "#DCE8D4"];
export const TEXT_PRIMARY = "#1A1A2E";
export const TEXT_MUTED = "#52525b";
export const TEXT_LIGHT = "#71717a";
export const BORDER_LIGHT = "#e2e8f0";

export const card = StyleSheet.create({
  base: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});

export const RESPONSE_COLORS: Record<string, { bg: string; text: string }> = {
  Excellent: { bg: "#dcfce7", text: "#166534" },
  Good: { bg: "#dcfce7", text: "#166534" },
  Moderate: { bg: "#fef9c3", text: "#854d0e" },
  Fair: { bg: "#fef9c3", text: "#854d0e" },
  Poor: { bg: "#fee2e2", text: "#991b1b" },
};
