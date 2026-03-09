/**
 * Pipeline Stage Chip
 * Compact card/pill: stage name on top, large count below. Easy to tap.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, typography, radius, touch } from "./styles";

interface PipelineStageChipProps {
  label: string;
  count: number;
  isActive?: boolean;
  severity?: "info" | "success" | "warning" | "danger";
  onPress?: () => void;
}

const accentColors: Record<string, string> = {
  danger: colors.danger,
  warning: colors.warning,
  success: colors.success,
  info: colors.primary,
};

export function PipelineStageChip({
  label,
  count,
  isActive = false,
  severity,
  onPress,
}: PipelineStageChipProps) {
  const accent = severity ? accentColors[severity] ?? colors.primary : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[
        styles.container,
        isActive && [styles.containerActive, { backgroundColor: accent }],
      ]}
    >
      <Text
        style={[
          styles.label,
          isActive && styles.labelActive,
          !isActive && severity === "danger" && { color: colors.danger },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.count,
          isActive && styles.countActive,
          !isActive && { color: accent },
        ]}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minWidth: 96,
    minHeight: 56,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  containerActive: {
    borderColor: colors.primary,
  },
  label: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelActive: {
    color: "rgba(255,255,255,0.95)",
  },
  count: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
  },
  countActive: {
    color: colors.textInverse,
  },
});
