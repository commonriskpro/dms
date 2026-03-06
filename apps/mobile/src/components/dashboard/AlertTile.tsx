/**
 * Alert Tile Component
 * Light, simple tile: icon, title, large count. Softer than KPI cards.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, radius, touch } from "./styles";

interface AlertTileProps {
  title: string;
  count: number;
  severity?: "info" | "success" | "warning" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

const severityBg: Record<string, string> = {
  danger: "rgba(239,68,68,0.06)",
  warning: "rgba(245,158,11,0.06)",
  success: "rgba(34,197,94,0.06)",
  info: "#F0F4F8",
};

const severityColor: Record<string, string> = {
  danger: colors.danger,
  warning: colors.warning,
  success: colors.success,
  info: colors.textSecondary,
};

export function AlertTile({
  title,
  count,
  severity = "info",
  icon,
  onPress,
}: AlertTileProps) {
  const bg = severityBg[severity] ?? severityBg.info;
  const accent = severityColor[severity] ?? severityColor.info;
  const defaultIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    danger: "alert-circle-outline",
    warning: "time-outline",
    success: "checkmark-circle-outline",
    info: "information-circle-outline",
  };

  const tileContent = (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Ionicons
        name={icon || defaultIcon[severity]}
        size={22}
        color={accent}
        style={styles.icon}
      />
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.count, { color: accent }]}>{count}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.78}
        style={styles.touchable}
      >
        {tileContent}
      </TouchableOpacity>
    );
  }
  return <View style={styles.touchable}>{tileContent}</View>;
}

const styles = StyleSheet.create({
  touchable: {
    width: 108,
    minHeight: 100,
  },
  container: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.cardPadding,
    minHeight: 100,
  },
  icon: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizeXs,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
    lineHeight: 14,
    marginBottom: spacing.sm,
  },
  count: {
    fontSize: typography.sizeXxl,
    fontWeight: typography.weightBold,
  },
});
