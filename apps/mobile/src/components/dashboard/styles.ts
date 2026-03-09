/**
 * Dashboard shared styles and design tokens
 * Centralized to avoid magic numbers and ensure consistency
 */

import { StyleSheet } from "react-native";

// Color palette
export const colors = {
  // Primary
  primary: "#208AEF",
  primaryDark: "#1a6fc2",

  // Backgrounds
  background: "#F5F7FA",
  surface: "#FFFFFF",
  darkHeader: "#1a2744",
  darkHeaderGradient: ["#1a2744", "#243456"],

  // Text
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#888888",
  textInverse: "#FFFFFF",

  // Semantic
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",

  // UI
  border: "#E5E7EB",
  divider: "#F0F0F0",
  shadow: "#000000",
};

// Spacing scale (aligned to mock: 16–20 screen, 20–24 section gap)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  // Dashboard-specific
  screenHorizontal: 18,
  sectionGap: 24,
  cardPadding: 18,
  rowMinHeight: 68,
};

// Typography (stronger hierarchy: large KPIs, clear section titles)
export const typography = {
  sizeXs: 11,
  sizeSm: 13,
  sizeMd: 15,
  sizeLg: 17,
  sizeXl: 20,
  sizeXxl: 28,
  sizeXxxl: 34,
  sizeDisplay: 36, // KPI value size
  // Section
  sectionTitle: 18,
  sectionSubtitle: 13,
  // Weights
  weightRegular: "400" as const,
  weightMedium: "500" as const,
  weightSemibold: "600" as const,
  weightBold: "700" as const,
};

// Border radius (cards 16–20 for premium feel)
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Touch targets (min 44, list rows 68–72)
export const touch = {
  minHeight: 44,
  minWidth: 44,
  rowHeight: 68,
  rowHeightLarge: 72,
  cardMinHeight: 120,
  kpiCardMinHeight: 124,
};

// Shadows (premium depth for cards and FAB)
export const shadows = {
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Common component styles
export const commonStyles = StyleSheet.create({
  // Section containers (consistent section gap)
  section: {
    marginBottom: spacing.sectionGap,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sectionTitle,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: typography.sectionSubtitle,
    color: colors.textSecondary,
  },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  // List rows (premium row height)
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touch.rowHeight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.cardPadding,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  // Icons (larger for follow-ups / appointments)
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },

  // Utility
  flex1: { flex: 1 },
  rowFlex: { flexDirection: "row", alignItems: "center" },
  centered: { justifyContent: "center", alignItems: "center" },
});
