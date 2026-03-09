/**
 * KPI Card Component
 * Large, premium card: label, dominant value, trend, subtle icon
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, radius, touch, shadows } from "./styles";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  variant?: "light" | "dark";
}

export function KpiCard({
  label,
  value,
  trend,
  trendDirection = "neutral",
  icon,
  onPress,
  variant = "light",
}: KpiCardProps) {
  const isDark = variant === "dark";

  const trendColor =
    trendDirection === "up"
      ? colors.success
      : trendDirection === "down"
        ? colors.danger
        : isDark
          ? "rgba(255,255,255,0.55)"
          : colors.textMuted;

  const renderTrend = () => {
    if (!trend) return null;
    return (
      <View style={styles.trendRow}>
        {trendDirection !== "neutral" && (
          <Ionicons
            name={trendDirection === "up" ? "trending-up" : "trending-down"}
            size={12}
            color={trendColor}
            style={styles.trendIcon}
          />
        )}
        <Text style={[styles.trendText, { color: trendColor }]}>{trend}</Text>
      </View>
    );
  };

  const cardContent = (
    <View
      style={[
        styles.container,
        isDark ? styles.containerDark : styles.containerLight,
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}
        >
          {label}
        </Text>
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isDark ? "rgba(255,255,255,0.4)" : colors.primary}
          />
        )}
      </View>
      <Text
        style={[styles.value, isDark ? styles.valueDark : styles.valueLight]}
      >
        {value}
      </Text>
      {renderTrend()}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        style={styles.touchable}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }
  return <View style={styles.touchable}>{cardContent}</View>;
}

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minHeight: touch.kpiCardMinHeight,
  },
  container: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.cardPadding,
    minHeight: touch.kpiCardMinHeight,
    justifyContent: "space-between",
  },
  containerLight: {
    backgroundColor: colors.surface,
    ...shadows.md,
  },
  containerDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
  },
  labelLight: { color: colors.textSecondary },
  labelDark: { color: "rgba(255,255,255,0.75)" },
  value: {
    fontSize: typography.sizeDisplay,
    fontWeight: typography.weightBold,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  valueLight: { color: colors.textPrimary },
  valueDark: { color: colors.textInverse },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trendIcon: { marginRight: spacing.xs },
  trendText: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightMedium,
  },
});
