/**
 * Appointment Row Component
 * Clean, readable row for appointments with time block, title, and details
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, radius, touch, commonStyles } from "./styles";

interface AppointmentRowProps {
  time: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: "confirmed" | "pending" | "completed" | "cancelled";
  onPress?: () => void;
  showChevron?: boolean;
}

export function AppointmentRow({
  time,
  title,
  subtitle,
  meta,
  status = "confirmed",
  onPress,
  showChevron = true,
}: AppointmentRowProps) {
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return colors.success;
      case "cancelled":
        return colors.danger;
      case "pending":
        return colors.warning;
      case "confirmed":
      default:
        return colors.primary;
    }
  };

  const rowContent = (
    <View style={styles.row}>
      {/* Time Block */}
      <View style={styles.timeContainer}>
        <View
          style={[
            styles.timeIndicator,
            { backgroundColor: getStatusColor() },
          ]}
        />
        <Text style={styles.timeText}>{time}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        {meta && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      {/* Chevron */}
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          style={styles.chevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {rowContent}
      </TouchableOpacity>
    );
  }

  return rowContent;
}

const styles = StyleSheet.create({
  touchable: {
    minHeight: touch.rowHeight,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touch.rowHeightLarge,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.cardPadding,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
    marginRight: spacing.md,
  },
  timeIndicator: {
    width: 4,
    height: 44,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  timeText: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizeMd,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
