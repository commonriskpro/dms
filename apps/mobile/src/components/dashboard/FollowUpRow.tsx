/**
 * Follow Up Row Component
 * Large, readable row for follow-up tasks with icon, title, subtitle, and action
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography, radius, touch, commonStyles } from "./styles";

interface FollowUpRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  overdue?: boolean;
  onPress?: () => void;
  onActionPress?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  showChevron?: boolean;
}

export function FollowUpRow({
  icon = "call-outline",
  iconColor = colors.primary,
  iconBackgroundColor = colors.background,
  title,
  subtitle,
  meta,
  overdue = false,
  onPress,
  onActionPress,
  actionIcon = "chevron-forward",
  showChevron = true,
}: FollowUpRowProps) {
  const rowContent = (
      <View style={[styles.row, styles.rowInner]}>
      {/* Icon */}
      <View
        style={[
          commonStyles.iconCircle,
          { backgroundColor: iconBackgroundColor },
          overdue && { backgroundColor: "rgba(239,68,68,0.1)" },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={overdue ? colors.danger : iconColor}
        />
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
          <Text
            style={[
              styles.meta,
              overdue && { color: colors.danger },
            ]}
          >
            {meta}
          </Text>
        )}
      </View>

      {/* Action */}
      {showChevron && (
        <TouchableOpacity
          onPress={onActionPress || onPress}
          style={styles.actionButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={actionIcon}
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
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
    minHeight: touch.rowHeightLarge,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowInner: {
    minHeight: touch.rowHeightLarge,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.cardPadding,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
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
  actionButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
});
