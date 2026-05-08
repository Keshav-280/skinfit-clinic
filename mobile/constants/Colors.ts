const tintColorLight = "#0d9488";
const tintColorDark = "#2dd4bf";
const bgLight = "#f8f5ef";
const textPrimary = "#18181b";
const textMuted = "#64748b";
const card = "#ffffff";
const border = "#e2e8f0";

export default {
  light: {
    text: textPrimary,
    background: bgLight,
    tint: tintColorLight,
    tabIconDefault: "#a1a1aa",
    tabIconSelected: tintColorLight,
    muted: textMuted,
    card,
    border,
  },
  dark: {
    text: "#fff",
    background: "#000",
    tint: tintColorDark,
    tabIconDefault: "#ccc",
    tabIconSelected: tintColorDark,
    muted: "#a1a1aa",
    card: "#111827",
    border: "#1f2937",
  },
};
