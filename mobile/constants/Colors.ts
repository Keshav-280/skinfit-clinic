import { SKINFIT_THEME } from "@/lib/skinfitTheme";

const primary = SKINFIT_THEME.navy;
const primaryDark = SKINFIT_THEME.navyDark;
const primaryLight = SKINFIT_THEME.mint;
const accent = SKINFIT_THEME.navyMid;
const bgLight = SKINFIT_THEME.mint;
const textPrimary = SKINFIT_THEME.text;
const textSecondary = SKINFIT_THEME.textMuted;
const textMuted = "#9CA3AF";
const card = "#FFFFFF";
const surface = "#FFFFFF";
const border = "#E5E7EB";
const inputBg = "#F3F4F6";

export default {
  light: {
    text: textPrimary,
    background: bgLight,
    tint: primary,
    tabIconDefault: "#9CA3AF",
    tabIconSelected: primary,
    muted: textSecondary,
    card,
    border,
    primary,
    primaryDark,
    primaryLight,
    accent,
    surface,
    inputBg,
    textMuted,
  },
  dark: {
    text: "#fff",
    background: "#0f172a",
    tint: "#93c5fd",
    tabIconDefault: "#94a3b8",
    tabIconSelected: "#93c5fd",
    muted: "#94a3b8",
    card: "#1e293b",
    border: "#334155",
    primary: "#93c5fd",
    primaryDark: "#60a5fa",
    primaryLight: "#1e3a5f",
    accent: "#60a5fa",
    surface: "#1e293b",
    inputBg: "#334155",
    textMuted: "#64748b",
  },
};
